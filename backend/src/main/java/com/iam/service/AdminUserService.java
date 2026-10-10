package com.iam.service;

import com.iam.dto.*;
import com.iam.entity.*;
import com.iam.exception.ResourceNotFoundException;
import com.iam.repository.*;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserService.class);

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserMfaSettingsRepository userMfaSettingsRepository;
    private final UserRecoveryCodeRepository userRecoveryCodeRepository;
    private final UserSessionRepository userSessionRepository;
    private final SecurityEventRepository securityEventRepository;
    private final SessionManagerService sessionManagerService;

    public AdminUserService(UserRepository userRepository,
                            RoleRepository roleRepository,
                            UserMfaSettingsRepository userMfaSettingsRepository,
                            UserRecoveryCodeRepository userRecoveryCodeRepository,
                            UserSessionRepository userSessionRepository,
                            SecurityEventRepository securityEventRepository,
                            SessionManagerService sessionManagerService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userMfaSettingsRepository = userMfaSettingsRepository;
        this.userRecoveryCodeRepository = userRecoveryCodeRepository;
        this.userSessionRepository = userSessionRepository;
        this.securityEventRepository = securityEventRepository;
        this.sessionManagerService = sessionManagerService;
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminUserSummaryDto> getUsers(String search, String status, String mfa, String role, Pageable pageable) {
        Specification<User> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 1. Text search across username, email, firstName, lastName
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                Predicate usernameMatch = cb.like(cb.lower(root.get("username")), pattern);
                Predicate emailMatch = cb.like(cb.lower(root.get("email")), pattern);
                Predicate firstMatch = cb.like(cb.lower(root.get("firstName")), pattern);
                Predicate lastMatch = cb.like(cb.lower(root.get("lastName")), pattern);
                predicates.add(cb.or(usernameMatch, emailMatch, firstMatch, lastMatch));
            }

            // 2. Status filter
            if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
                if ("active".equalsIgnoreCase(status)) {
                    predicates.add(cb.and(cb.isTrue(root.get("enabled")), cb.isTrue(root.get("accountNonLocked"))));
                } else if ("disabled".equalsIgnoreCase(status)) {
                    predicates.add(cb.isFalse(root.get("enabled")));
                } else if ("locked".equalsIgnoreCase(status)) {
                    predicates.add(cb.isFalse(root.get("accountNonLocked")));
                }
            }

            // 3. Role filter
            if (role != null && !role.isBlank() && !"all".equalsIgnoreCase(role)) {
                Join<User, Role> rolesJoin = root.join("roles");
                predicates.add(cb.equal(rolesJoin.get("name"), role));
            }

            // Distinct to avoid duplicates when joining collections
            query.distinct(true);

            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<User> page = userRepository.findAll(spec, pageable);

        List<AdminUserSummaryDto> dtoList = page.getContent().stream().map(u -> {
            Set<String> roleNames = u.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
            boolean mfaEnabled = userMfaSettingsRepository.existsByUserIdAndMfaEnabledTrue(u.getId());
            long activeSessions = userSessionRepository.countByUserIdAndRevokedFalse(u.getId());

            // Optional filter by MFA in memory if specified
            return new AdminUserSummaryDto(
                    u.getId(),
                    u.getUsername(),
                    u.getEmail(),
                    u.getFirstName(),
                    u.getLastName(),
                    u.isEnabled(),
                    u.isAccountNonLocked(),
                    roleNames,
                    mfaEnabled,
                    u.getCreatedAt(),
                    null,
                    activeSessions
            );
        }).collect(Collectors.toList());

        // Handle MFA post-filtering if mfa param was provided
        if (mfa != null && !mfa.isBlank() && !"all".equalsIgnoreCase(mfa)) {
            boolean requireMfa = "mfa_enabled".equalsIgnoreCase(mfa) || "enabled".equalsIgnoreCase(mfa);
            dtoList = dtoList.stream().filter(d -> d.isMfaEnabled() == requireMfa).collect(Collectors.toList());
        }

        return PageResponse.of(page, dtoList);
    }

    @Transactional(readOnly = true)
    public AdminUserDetailDto getUserDetail(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        AdminUserDetailDto dto = new AdminUserDetailDto();
        dto.setId(user.getId());
        dto.setUsername(user.getUsername());
        dto.setEmail(user.getEmail());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setEnabled(user.isEnabled());
        dto.setAccountNonLocked(user.isAccountNonLocked());
        dto.setAccountNonExpired(user.isAccountNonExpired());
        dto.setCredentialsNonExpired(user.isCredentialsNonExpired());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setUpdatedAt(user.getUpdatedAt());

        Set<String> roleNames = new HashSet<>();
        Set<String> authNames = new HashSet<>();
        if (user.getRoles() != null) {
            for (Role r : user.getRoles()) {
                roleNames.add(r.getName());
                if (r.getAuthorities() != null) {
                    for (Authority a : r.getAuthorities()) {
                        authNames.add(a.getName());
                    }
                }
            }
        }
        dto.setRoles(roleNames);
        dto.setAuthorities(authNames);

        // MFA details (Safe metadata only, never secrets)
        userMfaSettingsRepository.findByUserId(user.getId()).ifPresentOrElse(mfa -> {
            dto.setMfaEnabled(mfa.isMfaEnabled());
            dto.setMfaEnrolledAt(mfa.getEnrolledAt());
            dto.setRecoveryCodesRemaining(userRecoveryCodeRepository.countByUserIdAndUsedFalse(user.getId()));
        }, () -> {
            dto.setMfaEnabled(false);
            dto.setMfaEnrolledAt(null);
            dto.setRecoveryCodesRemaining(0);
        });

        // Active Sessions
        List<SessionDto> sessions = sessionManagerService.getSessionsByUserId(user.getId());
        dto.setActiveSessions(sessions);

        // Recent Security Events
        List<SecurityEventDto> events = sessionManagerService.getSecurityEvents(user.getId(), false);
        dto.setRecentSecurityEvents(events.stream().limit(15).collect(Collectors.toList()));

        return dto;
    }

    @Transactional
    public void updateUserStatus(Long id, boolean enabled, String adminUsername, HttpServletRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        // Requirement 9: Admin self-protection & prevent zero active admins
        if (!enabled && isUserActiveAdmin(user) && userRepository.countActiveAdmins() <= 1) {
            throw new IllegalStateException("Cannot disable the last active administrator on the system.");
        }

        user.setEnabled(enabled);
        userRepository.save(user);

        String clientIp = extractClientIp(request);

        if (!enabled) {
            // Revoke all active sessions immediately
            sessionManagerService.revokeAllUserSessions(user.getId(), "Account disabled by admin " + adminUsername, null, true);
            sessionManagerService.recordSecurityEvent(
                    "ADMIN_DISABLED_USER", user.getId(), user.getUsername(), null, clientIp, "Account disabled by admin: " + adminUsername
            );
            log.info("Admin '{}' disabled user '{}' and revoked all active sessions", adminUsername, user.getUsername());
        } else {
            sessionManagerService.recordSecurityEvent(
                    "ADMIN_ENABLED_USER", user.getId(), user.getUsername(), null, clientIp, "Account re-enabled by admin: " + adminUsername
            );
            log.info("Admin '{}' re-enabled user '{}'", adminUsername, user.getUsername());
        }
    }

    @Transactional
    public void lockUser(Long id, String reason, String adminUsername, HttpServletRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        // Requirement 9: Admin self-protection & prevent locking the final active admin
        if (isUserActiveAdmin(user) && userRepository.countActiveAdmins() <= 1) {
            throw new IllegalStateException("Cannot lock the last active administrator on the system.");
        }

        user.setAccountNonLocked(false);
        userRepository.save(user);

        // Revoke active sessions immediately
        sessionManagerService.revokeAllUserSessions(user.getId(), "Account locked by admin " + adminUsername, null, true);

        String clientIp = extractClientIp(request);
        String details = "Account locked by admin: " + adminUsername + (reason != null && !reason.isBlank() ? " (Reason: " + reason + ")" : "");
        sessionManagerService.recordSecurityEvent(
                "ADMIN_LOCKED_USER", user.getId(), user.getUsername(), null, clientIp, details
        );
        log.info("Admin '{}' locked user '{}'", adminUsername, user.getUsername());
    }

    @Transactional
    public void unlockUser(Long id, String adminUsername, HttpServletRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        user.setAccountNonLocked(true);
        userRepository.save(user);

        // Also clear any temporary MFA lockout
        userMfaSettingsRepository.findByUserId(user.getId()).ifPresent(mfa -> {
            mfa.setFailedAttempts(0);
            mfa.setLockoutUntil(null);
            userMfaSettingsRepository.save(mfa);
        });

        String clientIp = extractClientIp(request);
        sessionManagerService.recordSecurityEvent(
                "ADMIN_UNLOCKED_USER", user.getId(), user.getUsername(), null, clientIp, "Account unlocked by admin: " + adminUsername
        );
        log.info("Admin '{}' unlocked user '{}'", adminUsername, user.getUsername());
    }

    @Transactional
    public void updateUserRoles(Long id, Set<String> roleNames, String adminUsername, HttpServletRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));

        if (roleNames == null || roleNames.isEmpty()) {
            throw new IllegalArgumentException("User must have at least one assigned role.");
        }

        boolean currentlyAdmin = isUserActiveAdmin(user);
        boolean requestedAdmin = roleNames.stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r) || "ADMIN".equalsIgnoreCase(r));

        // Requirement 9: Prevent removing the administrative role if this is the final active admin
        if (currentlyAdmin && !requestedAdmin && userRepository.countActiveAdmins() <= 1) {
            throw new IllegalStateException("Cannot remove administrative privileges from the final active administrator.");
        }

        Set<Role> resolvedRoles = new HashSet<>();
        for (String rName : roleNames) {
            String formatted = rName.toUpperCase().startsWith("ROLE_") ? rName.toUpperCase() : "ROLE_" + rName.toUpperCase();
            Role role = roleRepository.findByName(formatted)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + rName));
            resolvedRoles.add(role);
        }

        user.setRoles(resolvedRoles);
        userRepository.save(user);

        String clientIp = extractClientIp(request);
        String details = "Roles updated by admin " + adminUsername + " to: " + resolvedRoles.stream().map(Role::getName).collect(Collectors.joining(", "));
        sessionManagerService.recordSecurityEvent(
                "ADMIN_ROLE_ASSIGNED", user.getId(), user.getUsername(), null, clientIp, details
        );
        log.info("Admin '{}' updated roles for user '{}' to {}", adminUsername, user.getUsername(), resolvedRoles);
    }

    @Transactional(readOnly = true)
    public AdminDashboardStatsDto getDashboardStats() {
        AdminDashboardStatsDto stats = new AdminDashboardStatsDto();
        stats.setTotalUsers(userRepository.count());
        stats.setActiveUsers(userRepository.countByEnabledTrue());
        stats.setDisabledUsers(userRepository.countByEnabledFalse());
        stats.setLockedUsers(userRepository.countByAccountNonLockedFalse());
        stats.setMfaEnabledUsers(userMfaSettingsRepository.countByMfaEnabledTrue());
        stats.setActiveSessions(userSessionRepository.countByRevokedFalse());

        Instant past24h = Instant.now().minus(Duration.ofHours(24));
        stats.setFailedLogins24h(securityEventRepository.countFailedLoginsSince(past24h));

        Instant past7d = Instant.now().minus(Duration.ofDays(7));
        stats.setRecentSecurityEventsCount(securityEventRepository.countEventsSince(past7d));

        Map<String, Long> roleCounts = new HashMap<>();
        for (Role r : roleRepository.findAll()) {
            roleCounts.put(r.getName(), userRepository.countByRoleName(r.getName()));
        }
        stats.setRoleDistribution(roleCounts);

        return stats;
    }

    private boolean isUserActiveAdmin(User user) {
        if (user == null || !user.isEnabled()) {
            return false;
        }
        return user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equals(r.getName()));
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
