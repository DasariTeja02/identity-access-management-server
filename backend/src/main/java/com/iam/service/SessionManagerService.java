package com.iam.service;

import com.iam.dto.SecurityEventDto;
import com.iam.dto.SessionDto;
import com.iam.entity.SecurityEvent;
import com.iam.entity.User;
import com.iam.entity.UserSession;
import com.iam.exception.ResourceNotFoundException;
import com.iam.repository.SecurityEventRepository;
import com.iam.repository.UserRepository;
import com.iam.repository.UserSessionRepository;
import com.iam.security.UserAgentUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class SessionManagerService {

    private static final Logger log = LoggerFactory.getLogger(SessionManagerService.class);

    private final UserSessionRepository sessionRepository;
    private final SecurityEventRepository eventRepository;
    private final UserRepository userRepository;
    private final RedisSessionService redisSessionService;

    @Value("${iam.session.max-inactive-interval-seconds:1800}")
    private long inactivityTimeoutSeconds;

    @Value("${iam.session.absolute-timeout-seconds:86400}")
    private long absoluteTimeoutSeconds;

    public SessionManagerService(UserSessionRepository sessionRepository,
                                 SecurityEventRepository eventRepository,
                                 UserRepository userRepository,
                                 RedisSessionService redisSessionService) {
        this.sessionRepository = sessionRepository;
        this.eventRepository = eventRepository;
        this.userRepository = userRepository;
        this.redisSessionService = redisSessionService;
    }

    @Transactional
    public UserSession createSession(User user, String sessionId, String clientId, HttpServletRequest request) {
        String ipAddress = extractClientIp(request);
        String userAgent = request != null ? request.getHeader("User-Agent") : "Unknown";
        UserAgentUtils.DeviceInfo deviceInfo = UserAgentUtils.parseUserAgent(userAgent);

        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(absoluteTimeoutSeconds);

        UserSession session = new UserSession();
        session.setUser(user);
        session.setSessionId(sessionId);
        session.setClientId(clientId != null ? clientId : "iam-web-portal");
        session.setIpAddress(ipAddress);
        session.setUserAgent(userAgent != null && userAgent.length() > 990 ? userAgent.substring(0, 990) : userAgent);
        session.setDeviceType(deviceInfo.getDeviceType());
        session.setBrowser(deviceInfo.getBrowser());
        session.setOperatingSystem(deviceInfo.getOperatingSystem());
        session.setCreatedAt(now);
        session.setLastActiveAt(now);
        session.setExpiresAt(expiresAt);
        session.setRevoked(false);

        UserSession saved = sessionRepository.save(session);

        // Store fast session state in Redis
        RedisSessionData redisData = new RedisSessionData();
        redisData.setSessionId(sessionId);
        redisData.setUserId(user.getId());
        redisData.setUsername(user.getUsername());
        redisData.setClientId(session.getClientId());
        redisData.setIpAddress(ipAddress);
        redisData.setUserAgent(session.getUserAgent());
        redisData.setDeviceType(deviceInfo.getDeviceType());
        redisData.setBrowser(deviceInfo.getBrowser());
        redisData.setOperatingSystem(deviceInfo.getOperatingSystem());
        redisData.setCreatedAt(now);
        redisData.setLastActiveAt(now);
        redisData.setExpiresAt(expiresAt);
        redisData.setStatus("ACTIVE");

        redisSessionService.saveSession(redisData, Duration.ofSeconds(absoluteTimeoutSeconds));

        // Record security audit events
        recordSecurityEvent("SESSION_CREATED", user.getId(), user.getUsername(), sessionId, ipAddress,
                "New session established for device: " + deviceInfo.getBrowser() + " on " + deviceInfo.getOperatingSystem());
        recordSecurityEvent("LOGIN_SUCCESS", user.getId(), user.getUsername(), sessionId, ipAddress,
                "User authenticated successfully");

        log.info("Created authenticated session: sessionId={}, user={}", sessionId, user.getUsername());
        return saved;
    }

    @Transactional(readOnly = true)
    public List<SessionDto> getSessionsForUser(User user, String currentSessionId) {
        List<UserSession> sessions = sessionRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        return sessions.stream()
                .map(s -> toSessionDto(s, currentSessionId))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SessionDto> getSessionsByUserId(Long userId) {
        List<UserSession> sessions = sessionRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return sessions.stream()
                .map(s -> toSessionDto(s, null))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SessionDto> getAllSessions(String currentSessionId) {
        List<UserSession> sessions = sessionRepository.findAllByOrderByCreatedAtDesc();
        return sessions.stream()
                .map(s -> toSessionDto(s, currentSessionId))
                .collect(Collectors.toList());
    }

    @Transactional
    public void revokeSession(String sessionId, String revokedBy, User requester, boolean isAdmin) {
        UserSession session = sessionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found: " + sessionId));

        if (!isAdmin && requester != null && !Objects.equals(session.getUser().getId(), requester.getId())) {
            throw new AccessDeniedException("You do not have permission to revoke another user's session.");
        }

        Instant now = Instant.now();
        session.setRevoked(true);
        session.setRevokedAt(now);
        session.setRevokedBy(revokedBy);
        sessionRepository.save(session);

        // Revoke in Redis cache and add to revocation blacklist
        redisSessionService.deleteSession(sessionId, session.getUser().getId());
        redisSessionService.revokeSession(sessionId, Duration.ofSeconds(absoluteTimeoutSeconds));

        recordSecurityEvent("SESSION_REVOKED", session.getUser().getId(), session.getUser().getUsername(),
                sessionId, session.getIpAddress(), "Session revoked by: " + revokedBy);

        log.info("Session revoked: sessionId={}, by={}", sessionId, revokedBy);
    }

    @Transactional
    public void revokeAllUserSessions(Long userId, String revokedBy, User requester, boolean isAdmin) {
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + userId));

        if (!isAdmin && requester != null && !Objects.equals(targetUser.getId(), requester.getId())) {
            throw new AccessDeniedException("You do not have permission to revoke another user's sessions.");
        }

        Instant now = Instant.now();
        sessionRepository.revokeAllByUserId(userId, now, revokedBy);

        redisSessionService.deleteAllUserSessions(userId);

        recordSecurityEvent("LOGOUT_ALL", userId, targetUser.getUsername(),
                null, null, "All active sessions revoked by: " + revokedBy);

        log.info("All active sessions revoked for user: {}, by={}", targetUser.getUsername(), revokedBy);
    }

    @Transactional
    public void touchSession(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }
        Instant now = Instant.now();
        sessionRepository.updateLastActiveAt(sessionId, now);
        redisSessionService.touchSession(sessionId, Duration.ofSeconds(absoluteTimeoutSeconds));
    }

    @Transactional(readOnly = true)
    public boolean isSessionValid(String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return false;
        }

        // Fast check in Redis blacklist
        if (redisSessionService.isSessionRevoked(sessionId)) {
            return false;
        }

        return sessionRepository.findBySessionId(sessionId)
                .map(s -> {
                    if (s.isRevoked()) {
                        return false;
                    }
                    Instant now = Instant.now();
                    if (now.isAfter(s.getExpiresAt())) {
                        return false;
                    }
                    // Check inactivity timeout
                    if (Duration.between(s.getLastActiveAt(), now).getSeconds() > inactivityTimeoutSeconds) {
                        return false;
                    }
                    return true;
                })
                .orElse(false);
    }

    @Transactional
    public void recordSecurityEvent(String eventType, Long userId, String username, String sessionId, String ipAddress, String details) {
        SecurityEvent event = new SecurityEvent(eventType, userId, username, sessionId, ipAddress, details);
        eventRepository.save(event);
    }

    @Transactional(readOnly = true)
    public List<SecurityEventDto> getSecurityEvents(Long userId, boolean isAdmin) {
        List<SecurityEvent> events;
        if (isAdmin && userId == null) {
            events = eventRepository.findAllByOrderByTimestampDesc();
        } else if (userId != null) {
            events = eventRepository.findByUserIdOrderByTimestampDesc(userId);
        } else {
            events = List.of();
        }

        return events.stream().map(e -> {
            SecurityEventDto dto = new SecurityEventDto();
            dto.setId(e.getId());
            dto.setEventType(e.getEventType());
            dto.setUserId(e.getUserId());
            dto.setUsername(e.getUsername());
            dto.setSessionId(e.getSessionId());
            dto.setIpAddress(e.getIpAddress());
            dto.setDetails(e.getDetails());
            dto.setTimestamp(e.getTimestamp());
            return dto;
        }).collect(Collectors.toList());
    }

    private SessionDto toSessionDto(UserSession s, String currentSessionId) {
        SessionDto dto = new SessionDto();
        dto.setId(s.getId());
        dto.setSessionId(s.getSessionId());
        dto.setUsername(s.getUser().getUsername());
        dto.setClientName(s.getClientId());
        dto.setIpAddress(s.getIpAddress());
        dto.setUserAgent(s.getUserAgent());
        dto.setDeviceType(s.getDeviceType());
        dto.setBrowser(s.getBrowser());
        dto.setOperatingSystem(s.getOperatingSystem());
        dto.setCreatedAt(s.getCreatedAt());
        dto.setLastActiveAt(s.getLastActiveAt());
        dto.setExpiresAt(s.getExpiresAt());
        dto.setRevoked(s.isRevoked());
        dto.setRevokedAt(s.getRevokedAt());

        boolean isCurrent = currentSessionId != null && currentSessionId.equals(s.getSessionId());
        dto.setCurrent(isCurrent);

        Instant now = Instant.now();
        if (s.isRevoked()) {
            dto.setStatus("REVOKED");
        } else if (now.isAfter(s.getExpiresAt()) || Duration.between(s.getLastActiveAt(), now).getSeconds() > inactivityTimeoutSeconds) {
            dto.setStatus("EXPIRED");
        } else {
            dto.setStatus("ACTIVE");
        }

        return dto;
    }

    private String extractClientIp(HttpServletRequest request) {
        if (request == null) {
            return "127.0.0.1";
        }
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}
