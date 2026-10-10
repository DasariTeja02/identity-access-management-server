package com.iam.service;

import com.iam.dto.*;
import com.iam.entity.User;
import com.iam.entity.UserMfaSettings;
import com.iam.entity.UserRecoveryCode;
import com.iam.exception.InvalidCredentialsException;
import com.iam.exception.InvalidTokenException;
import com.iam.exception.ResourceNotFoundException;
import com.iam.repository.UserMfaSettingsRepository;
import com.iam.repository.UserRecoveryCodeRepository;
import com.iam.repository.UserRepository;
import com.iam.security.CryptoUtils;
import com.iam.security.CustomUserDetailsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MfaService {

    private static final Logger log = LoggerFactory.getLogger(MfaService.class);

    private final UserMfaSettingsRepository userMfaSettingsRepository;
    private final UserRecoveryCodeRepository userRecoveryCodeRepository;
    private final UserRepository userRepository;
    private final TotpService totpService;
    private final CryptoUtils cryptoUtils;
    private final RedisSessionService redisSessionService;
    private final SessionManagerService sessionManagerService;
    private final CustomUserDetailsService userDetailsService;
    private final PasswordEncoder passwordEncoder;
    private final UserMapper userMapper;

    @Value("${iam.mfa.challenge-timeout-seconds:300}")
    private int challengeTimeoutSeconds;

    @Value("${iam.mfa.max-attempts:5}")
    private int maxAttempts;

    @Value("${iam.mfa.lockout-seconds:300}")
    private int lockoutSeconds;

    public MfaService(UserMfaSettingsRepository userMfaSettingsRepository,
                      UserRecoveryCodeRepository userRecoveryCodeRepository,
                      UserRepository userRepository,
                      TotpService totpService,
                      CryptoUtils cryptoUtils,
                      RedisSessionService redisSessionService,
                      SessionManagerService sessionManagerService,
                      CustomUserDetailsService userDetailsService,
                      PasswordEncoder passwordEncoder,
                      UserMapper userMapper) {
        this.userMfaSettingsRepository = userMfaSettingsRepository;
        this.userRecoveryCodeRepository = userRecoveryCodeRepository;
        this.userRepository = userRepository;
        this.totpService = totpService;
        this.cryptoUtils = cryptoUtils;
        this.redisSessionService = redisSessionService;
        this.sessionManagerService = sessionManagerService;
        this.userDetailsService = userDetailsService;
        this.passwordEncoder = passwordEncoder;
        this.userMapper = userMapper;
    }

    @Transactional(readOnly = true)
    public MfaStatusResponse getStatus(User user) {
        return userMfaSettingsRepository.findByUserId(user.getId())
                .filter(UserMfaSettings::isMfaEnabled)
                .map(settings -> {
                    long remaining = userRecoveryCodeRepository.countByUserIdAndUsedFalse(user.getId());
                    return new MfaStatusResponse(true, settings.getEnrolledAt(), remaining);
                })
                .orElseGet(() -> new MfaStatusResponse(false, null, 0));
    }

    @Transactional
    public MfaEnrollmentResponse startEnrollment(User user, HttpServletRequest request) {
        String secret = totpService.generateSecretKey();
        redisSessionService.savePendingEnrollmentSecret(user.getId(), secret, Duration.ofMinutes(10));

        String otpAuthUri = totpService.getOtpAuthUri(secret, user.getUsername());
        String qrCodeDataUri = totpService.generateQrCodeDataUri(otpAuthUri, 250, 250);

        String clientIp = extractClientIp(request);
        sessionManagerService.recordSecurityEvent(
                "MFA_ENROLLMENT_STARTED", user.getId(), user.getUsername(), null, clientIp, "User started MFA enrollment"
        );

        return new MfaEnrollmentResponse(secret, otpAuthUri, qrCodeDataUri);
    }

    @Transactional
    public MfaEnrollmentSuccessResponse verifyEnrollment(User user, String code, HttpServletRequest request) {
        String pendingSecret = redisSessionService.getPendingEnrollmentSecret(user.getId())
                .orElseThrow(() -> new InvalidTokenException("MFA enrollment session expired or not found. Please restart enrollment."));

        if (!totpService.verifyCode(pendingSecret, code)) {
            sessionManagerService.recordSecurityEvent(
                    "MFA_VERIFICATION_FAILED", user.getId(), user.getUsername(), null, extractClientIp(request), "Failed TOTP code during enrollment verification"
            );
            throw new InvalidCredentialsException("Invalid verification code. Please check your authenticator app and try again.");
        }

        String encryptedSecret = cryptoUtils.encrypt(pendingSecret);
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    UserMfaSettings s = new UserMfaSettings();
                    s.setUser(user);
                    return s;
                });

        Instant now = Instant.now();
        settings.setMfaEnabled(true);
        settings.setEncryptedSecret(encryptedSecret);
        settings.setEnrolledAt(now);
        settings.setLastVerifiedAt(now);
        settings.setFailedAttempts(0);
        settings.setLockoutUntil(null);
        userMfaSettingsRepository.save(settings);

        userRecoveryCodeRepository.deleteAllByUserId(user.getId());
        List<String> recoveryCodes = cryptoUtils.generateRecoveryCodes(8);
        for (String rc : recoveryCodes) {
            String hash = cryptoUtils.hashRecoveryCode(rc);
            userRecoveryCodeRepository.save(new UserRecoveryCode(user, hash));
        }

        redisSessionService.deletePendingEnrollmentSecret(user.getId());

        String clientIp = extractClientIp(request);
        sessionManagerService.recordSecurityEvent(
                "MFA_ENROLLMENT_COMPLETED", user.getId(), user.getUsername(), null, clientIp, "MFA successfully enrolled and enabled"
        );

        return new MfaEnrollmentSuccessResponse(true, "MFA has been successfully configured and enabled.", recoveryCodes);
    }

    public AuthResponse createLoginChallenge(User user, HttpServletRequest request) {
        String challengeToken = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plusSeconds(challengeTimeoutSeconds);
        MfaChallengeData challengeData = new MfaChallengeData(challengeToken, user.getId(), user.getUsername(), expiresAt);

        redisSessionService.saveMfaChallenge(challengeData, Duration.ofSeconds(challengeTimeoutSeconds));
        log.info("Created MFA login challenge for user: {}, challengeToken={}", user.getUsername(), challengeToken);

        return AuthResponse.mfaChallenge(challengeToken);
    }

    @Transactional(noRollbackFor = { InvalidCredentialsException.class, LockedException.class })
    public AuthResponse verifyChallenge(MfaChallengeVerifyRequest request, HttpServletRequest httpRequest) {
        String clientIp = extractClientIp(httpRequest);

        MfaChallengeData challenge = redisSessionService.getMfaChallenge(request.getChallengeToken())
                .orElseThrow(() -> new InvalidTokenException("MFA challenge has expired or is invalid. Please log in again."));

        User user = userRepository.findById(challenge.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found for MFA challenge"));

        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(user.getId())
                .orElseThrow(() -> new InvalidCredentialsException("MFA settings not configured for this user"));

        if (!settings.isMfaEnabled()) {
            throw new InvalidCredentialsException("MFA is not enabled for this user");
        }

        // Check lockout
        if (settings.getLockoutUntil() != null && settings.getLockoutUntil().isAfter(Instant.now())) {
            sessionManagerService.recordSecurityEvent(
                    "MFA_LOCKOUT", user.getId(), user.getUsername(), null, clientIp, "Access attempt while MFA lockout active"
            );
            throw new LockedException("Too many failed MFA attempts. Account temporarily locked until " + settings.getLockoutUntil());
        }

        // Check if using Recovery Code or TOTP Code
        if (request.getRecoveryCode() != null && !request.getRecoveryCode().isBlank()) {
            String recoveryCode = request.getRecoveryCode().trim().toUpperCase();
            String codeHash = cryptoUtils.hashRecoveryCode(recoveryCode);

            var codeEntityOpt = userRecoveryCodeRepository.findByUserIdAndCodeHashAndUsedFalse(user.getId(), codeHash);
            if (codeEntityOpt.isEmpty()) {
                handleFailedAttempt(settings, user, clientIp, "Invalid recovery code used");
                throw new InvalidCredentialsException("Invalid recovery code.");
            }

            // Consume recovery code
            UserRecoveryCode codeEntity = codeEntityOpt.get();
            codeEntity.setUsed(true);
            codeEntity.setUsedAt(Instant.now());
            userRecoveryCodeRepository.save(codeEntity);

            // Reset failed attempts
            settings.setFailedAttempts(0);
            userMfaSettingsRepository.save(settings);

            sessionManagerService.recordSecurityEvent(
                    "MFA_RECOVERY_CODE_USED", user.getId(), user.getUsername(), null, clientIp, "One-time recovery code used for login"
            );
        } else if (request.getCode() != null && !request.getCode().isBlank()) {
            String decryptedSecret = cryptoUtils.decrypt(settings.getEncryptedSecret());
            boolean isValid = totpService.verifyCode(decryptedSecret, request.getCode().trim());

            if (!isValid) {
                handleFailedAttempt(settings, user, clientIp, "Invalid TOTP verification code");
                throw new InvalidCredentialsException("Invalid 6-digit TOTP code. Please try again.");
            }

            // Reset failed attempts
            settings.setFailedAttempts(0);
            settings.setLastVerifiedAt(Instant.now());
            userMfaSettingsRepository.save(settings);

            sessionManagerService.recordSecurityEvent(
                    "MFA_VERIFICATION_SUCCESS", user.getId(), user.getUsername(), null, clientIp, "TOTP verification successful"
            );
        } else {
            throw new InvalidCredentialsException("Either TOTP code or recovery code must be provided.");
        }

        // Invalidate challenge so it cannot be reused
        redisSessionService.deleteMfaChallenge(request.getChallengeToken());

        return completeAuthentication(user, httpRequest);
    }

    private void handleFailedAttempt(UserMfaSettings settings, User user, String clientIp, String reason) {
        int failed = settings.getFailedAttempts() + 1;
        settings.setFailedAttempts(failed);

        if (failed >= maxAttempts) {
            settings.setLockoutUntil(Instant.now().plusSeconds(lockoutSeconds));
            sessionManagerService.recordSecurityEvent(
                    "MFA_LOCKOUT", user.getId(), user.getUsername(), null, clientIp, "Account temporarily locked due to " + failed + " consecutive MFA failures"
            );
        } else {
            sessionManagerService.recordSecurityEvent(
                    "MFA_VERIFICATION_FAILED", user.getId(), user.getUsername(), null, clientIp, reason + " (attempt " + failed + "/" + maxAttempts + ")"
            );
        }
        userMfaSettingsRepository.save(settings);
    }

    private AuthResponse completeAuthentication(User user, HttpServletRequest httpRequest) {
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities()
        );

        SecurityContext securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(authentication);
        SecurityContextHolder.setContext(securityContext);

        String sessionId = UUID.randomUUID().toString();
        if (httpRequest != null) {
            HttpSession session = httpRequest.getSession(true);
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, securityContext);
            session.setAttribute("IAM_SESSION_ID", sessionId);
        }

        sessionManagerService.createSession(user, sessionId, "iam-web-portal", httpRequest);

        UserDto userDto = userMapper.toUserDto(user);
        log.info("MFA authentication fully completed for user: {}", user.getUsername());
        return new AuthResponse(true, "Authentication successful", userDto, sessionId);
    }

    @Transactional
    public void disableMfa(User user, MfaDisableRequest request, HttpServletRequest httpRequest) {
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("MFA is not configured for this user"));

        if (!settings.isMfaEnabled()) {
            throw new IllegalStateException("MFA is already disabled.");
        }

        boolean reauthSuccess = false;
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            reauthSuccess = passwordEncoder.matches(request.getPassword(), user.getPassword());
        } else if (request.getCode() != null && !request.getCode().isBlank()) {
            String decryptedSecret = cryptoUtils.decrypt(settings.getEncryptedSecret());
            reauthSuccess = totpService.verifyCode(decryptedSecret, request.getCode().trim());
        }

        if (!reauthSuccess) {
            sessionManagerService.recordSecurityEvent(
                    "MFA_VERIFICATION_FAILED", user.getId(), user.getUsername(), null, extractClientIp(httpRequest), "Failed re-authentication attempt to disable MFA"
            );
            throw new InvalidCredentialsException("Invalid password or TOTP code. Strong re-authentication is required to disable MFA.");
        }

        settings.setMfaEnabled(false);
        settings.setEncryptedSecret(null);
        settings.setFailedAttempts(0);
        settings.setLockoutUntil(null);
        userMfaSettingsRepository.save(settings);

        userRecoveryCodeRepository.deleteAllByUserId(user.getId());

        String clientIp = extractClientIp(httpRequest);
        sessionManagerService.recordSecurityEvent(
                "MFA_DISABLED", user.getId(), user.getUsername(), null, clientIp, "MFA disabled by user after re-authentication"
        );
        log.info("MFA disabled for user: {}", user.getUsername());
    }

    @Transactional
    public List<String> regenerateRecoveryCodes(User user, MfaRegenerateRecoveryCodesRequest request, HttpServletRequest httpRequest) {
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("MFA is not configured for this user"));

        if (!settings.isMfaEnabled()) {
            throw new IllegalStateException("MFA must be enabled to regenerate recovery codes.");
        }

        boolean reauthSuccess = false;
        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            reauthSuccess = passwordEncoder.matches(request.getPassword(), user.getPassword());
        } else if (request.getCode() != null && !request.getCode().isBlank()) {
            String decryptedSecret = cryptoUtils.decrypt(settings.getEncryptedSecret());
            reauthSuccess = totpService.verifyCode(decryptedSecret, request.getCode().trim());
        }

        if (!reauthSuccess) {
            sessionManagerService.recordSecurityEvent(
                    "MFA_VERIFICATION_FAILED", user.getId(), user.getUsername(), null, extractClientIp(httpRequest), "Failed re-authentication to regenerate recovery codes"
            );
            throw new InvalidCredentialsException("Invalid password or TOTP code. Re-authentication required to regenerate recovery codes.");
        }

        userRecoveryCodeRepository.deleteAllByUserId(user.getId());
        List<String> newCodes = cryptoUtils.generateRecoveryCodes(8);
        for (String rc : newCodes) {
            userRecoveryCodeRepository.save(new UserRecoveryCode(user, cryptoUtils.hashRecoveryCode(rc)));
        }

        String clientIp = extractClientIp(httpRequest);
        sessionManagerService.recordSecurityEvent(
                "MFA_RECOVERY_CODES_REGENERATED", user.getId(), user.getUsername(), null, clientIp, "Recovery codes regenerated"
        );
        log.info("Recovery codes regenerated for user: {}", user.getUsername());

        return newCodes;
    }

    @Transactional
    public void adminResetMfa(Long userId, String adminUsername, HttpServletRequest httpRequest) {
        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + userId));

        userMfaSettingsRepository.findByUserId(userId).ifPresent(settings -> {
            settings.setMfaEnabled(false);
            settings.setEncryptedSecret(null);
            settings.setFailedAttempts(0);
            settings.setLockoutUntil(null);
            userMfaSettingsRepository.save(settings);
        });

        userRecoveryCodeRepository.deleteAllByUserId(userId);

        // Security requirement 22 & 24: Invalidate user sessions upon admin MFA reset
        sessionManagerService.revokeAllUserSessions(userId, "Admin MFA Reset by " + adminUsername, null, true);

        String clientIp = extractClientIp(httpRequest);
        sessionManagerService.recordSecurityEvent(
                "MFA_RESET_BY_ADMIN", userId, targetUser.getUsername(), null, clientIp, "MFA reset by administrator: " + adminUsername
        );
        log.info("MFA reset by admin '{}' for target user '{}'", adminUsername, targetUser.getUsername());
    }

    @Transactional(readOnly = true)
    public List<AdminMfaUserDto> adminGetUsers() {
        return userRepository.findAll().stream().map(u -> {
            var settingsOpt = userMfaSettingsRepository.findByUserId(u.getId());
            boolean enabled = settingsOpt.map(UserMfaSettings::isMfaEnabled).orElse(false);
            Instant enrolledAt = settingsOpt.map(UserMfaSettings::getEnrolledAt).orElse(null);
            long remaining = enabled ? userRecoveryCodeRepository.countByUserIdAndUsedFalse(u.getId()) : 0;
            return new AdminMfaUserDto(u.getId(), u.getUsername(), u.getEmail(), enabled, enrolledAt, remaining);
        }).collect(Collectors.toList());
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
