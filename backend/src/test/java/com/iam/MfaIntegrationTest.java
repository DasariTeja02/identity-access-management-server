package com.iam;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iam.dto.*;
import com.iam.entity.User;
import com.iam.entity.UserMfaSettings;
import com.iam.repository.UserMfaSettingsRepository;
import com.iam.repository.UserRecoveryCodeRepository;
import com.iam.repository.UserRepository;
import com.iam.security.CryptoUtils;
import com.iam.service.TotpService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
public class MfaIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserMfaSettingsRepository userMfaSettingsRepository;

    @Autowired
    private UserRecoveryCodeRepository userRecoveryCodeRepository;

    @Autowired
    private TotpService totpService;

    @Autowired
    private CryptoUtils cryptoUtils;

    private User testUser;
    private User adminUser;

    @BeforeEach
    void setUp() {
        testUser = userRepository.findByUsername("testuser").orElseThrow();
        adminUser = userRepository.findByUsername("admin").orElseThrow();

        // Clear any previous MFA settings for testuser
        userRecoveryCodeRepository.deleteAllByUserId(testUser.getId());
        userMfaSettingsRepository.findByUserId(testUser.getId()).ifPresent(s -> {
            s.setMfaEnabled(false);
            s.setEncryptedSecret(null);
            s.setFailedAttempts(0);
            s.setLockoutUntil(null);
            userMfaSettingsRepository.save(s);
        });
    }

    @Test
    @DisplayName("1. MFA status initially reports disabled with 0 recovery codes")
    void testInitialMfaStatus() throws Exception {
        mockMvc.perform(get("/api/mfa/status")
                        .with(user("testuser").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled", is(false)))
                .andExpect(jsonPath("$.data.recoveryCodesRemaining", is(0)));
    }

    @Test
    @DisplayName("2. MFA enrollment flow generates secret, otpauth URI, and QR code")
    void testStartEnrollment() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/mfa/enroll")
                        .with(user("testuser").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.secret").isNotEmpty())
                .andExpect(jsonPath("$.data.otpAuthUri", containsString("otpauth://totp/")))
                .andExpect(jsonPath("$.data.qrCodeDataUri", startsWith("data:image/png;base64,")))
                .andReturn();

        String content = result.getResponse().getContentAsString();
        MfaEnrollmentResponse enrollment = objectMapper.readTree(content).path("data").traverse(objectMapper)
                .readValueAs(MfaEnrollmentResponse.class);

        assertThat(enrollment.getSecret()).isNotBlank();
        assertThat(enrollment.getOtpAuthUri()).contains("testuser");
    }

    @Test
    @DisplayName("3. Verify MFA enrollment with valid TOTP enables MFA and returns 8 recovery codes")
    void testVerifyEnrollmentSuccess() throws Exception {
        // Step 1: Start enrollment
        MvcResult enrollResult = mockMvc.perform(post("/api/mfa/enroll")
                        .with(user("testuser").roles("USER")))
                .andExpect(status().isOk())
                .andReturn();

        String secret = objectMapper.readTree(enrollResult.getResponse().getContentAsString())
                .path("data").path("secret").asText();

        // Step 2: Compute valid TOTP code
        int currentCode = totpService.getCurrentCode(secret);
        String codeStr = String.format("%06d", currentCode);

        // Step 3: Verify enrollment
        MfaVerifyEnrollmentRequest verifyRequest = new MfaVerifyEnrollmentRequest(codeStr);
        MvcResult verifyResult = mockMvc.perform(post("/api/mfa/verify-enrollment")
                        .with(user("testuser").roles("USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(verifyRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled", is(true)))
                .andExpect(jsonPath("$.data.recoveryCodes", hasSize(8)))
                .andReturn();

        // Step 4: Verify DB state
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(testUser.getId()).orElseThrow();
        assertThat(settings.isMfaEnabled()).isTrue();
        assertThat(settings.getEncryptedSecret()).isNotNull();

        long remainingCodes = userRecoveryCodeRepository.countByUserIdAndUsedFalse(testUser.getId());
        assertThat(remainingCodes).isEqualTo(8);

        // Step 5: Check status API
        mockMvc.perform(get("/api/mfa/status")
                        .with(user("testuser").roles("USER")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.enabled", is(true)))
                .andExpect(jsonPath("$.data.recoveryCodesRemaining", is(8)));
    }

    @Test
    @DisplayName("4. Verify MFA enrollment with invalid TOTP code fails")
    void testVerifyEnrollmentWithInvalidCodeFails() throws Exception {
        mockMvc.perform(post("/api/mfa/enroll")
                        .with(user("testuser").roles("USER")))
                .andExpect(status().isOk());

        MfaVerifyEnrollmentRequest verifyRequest = new MfaVerifyEnrollmentRequest("999999");
        mockMvc.perform(post("/api/mfa/verify-enrollment")
                        .with(user("testuser").roles("USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(verifyRequest)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsString("Invalid verification code")));

        boolean enabled = userMfaSettingsRepository.existsByUserIdAndMfaEnabledTrue(testUser.getId());
        assertThat(enabled).isFalse();
    }

    @Test
    @DisplayName("5. Complete Login flow with MFA enabled: challenge required -> TOTP verified -> session created")
    void testLoginFlowWithMfaEnabled() throws Exception {
        // Enroll and enable MFA for testuser
        String secret = totpService.generateSecretKey();
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(testUser.getId()).orElse(new UserMfaSettings());
        settings.setUser(testUser);
        settings.setMfaEnabled(true);
        settings.setEncryptedSecret(cryptoUtils.encrypt(secret));
        settings.setEnrolledAt(java.time.Instant.now());
        userMfaSettingsRepository.save(settings);

        // Attempt login with username & password
        LoginRequest loginRequest = new LoginRequest("testuser", "User@123456");
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mfaRequired", is(true)))
                .andExpect(jsonPath("$.mfaChallengeToken").isNotEmpty())
                .andReturn();

        String challengeToken = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .path("mfaChallengeToken").asText();

        // Calculate valid TOTP code
        int currentCode = totpService.getCurrentCode(secret);
        String codeStr = String.format("%06d", currentCode);

        // Verify challenge
        MfaChallengeVerifyRequest challengeRequest = new MfaChallengeVerifyRequest(challengeToken, codeStr, null);
        mockMvc.perform(post("/api/mfa/challenge/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(challengeRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.sessionId").isNotEmpty())
                .andExpect(jsonPath("$.user.username", is("testuser")));
    }

    @Test
    @DisplayName("6. Login with invalid TOTP code is rejected and tracks failed attempts")
    void testLoginWithInvalidTotpCodeFails() throws Exception {
        String secret = totpService.generateSecretKey();
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(testUser.getId()).orElse(new UserMfaSettings());
        settings.setUser(testUser);
        settings.setMfaEnabled(true);
        settings.setEncryptedSecret(cryptoUtils.encrypt(secret));
        settings.setEnrolledAt(java.time.Instant.now());
        userMfaSettingsRepository.save(settings);

        LoginRequest loginRequest = new LoginRequest("testuser", "User@123456");
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String challengeToken = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .path("mfaChallengeToken").asText();

        MfaChallengeVerifyRequest badRequest = new MfaChallengeVerifyRequest(challengeToken, "000000", null);
        mockMvc.perform(post("/api/mfa/challenge/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badRequest)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsString("Invalid 6-digit TOTP code")));
    }

    @Test
    @DisplayName("7. Recovery code login succeeds and code cannot be reused")
    void testRecoveryCodeLoginAndOneTimeUse() throws Exception {
        String secret = totpService.generateSecretKey();
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(testUser.getId()).orElse(new UserMfaSettings());
        settings.setUser(testUser);
        settings.setMfaEnabled(true);
        settings.setEncryptedSecret(cryptoUtils.encrypt(secret));
        settings.setEnrolledAt(java.time.Instant.now());
        userMfaSettingsRepository.save(settings);

        // Generate recovery codes
        List<String> recoveryCodes = cryptoUtils.generateRecoveryCodes(8);
        for (String rc : recoveryCodes) {
            userRecoveryCodeRepository.save(new com.iam.entity.UserRecoveryCode(testUser, cryptoUtils.hashRecoveryCode(rc)));
        }

        String chosenCode = recoveryCodes.get(0);

        // Login to get challenge
        LoginRequest loginRequest = new LoginRequest("testuser", "User@123456");
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String challengeToken = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .path("mfaChallengeToken").asText();

        // Verify challenge using recovery code
        MfaChallengeVerifyRequest recoveryVerify = new MfaChallengeVerifyRequest(challengeToken, null, chosenCode);
        mockMvc.perform(post("/api/mfa/challenge/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(recoveryVerify)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.user.username", is("testuser")));

        // Verify code count decremented to 7
        long remaining = userRecoveryCodeRepository.countByUserIdAndUsedFalse(testUser.getId());
        assertThat(remaining).isEqualTo(7);

        // Try using the same recovery code on a new login -> MUST FAIL
        MvcResult loginResult2 = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String challengeToken2 = objectMapper.readTree(loginResult2.getResponse().getContentAsString())
                .path("mfaChallengeToken").asText();

        MfaChallengeVerifyRequest reuseVerify = new MfaChallengeVerifyRequest(challengeToken2, null, chosenCode);
        mockMvc.perform(post("/api/mfa/challenge/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(reuseVerify)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", containsString("Invalid recovery code")));
    }

    @Test
    @DisplayName("8. Disable MFA requires valid re-authentication")
    void testDisableMfaWithReauthentication() throws Exception {
        String secret = totpService.generateSecretKey();
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(testUser.getId()).orElse(new UserMfaSettings());
        settings.setUser(testUser);
        settings.setMfaEnabled(true);
        settings.setEncryptedSecret(cryptoUtils.encrypt(secret));
        settings.setEnrolledAt(java.time.Instant.now());
        userMfaSettingsRepository.save(settings);

        // Attempt disable with wrong password -> Fails
        MfaDisableRequest badDisable = new MfaDisableRequest("WrongPassword!", null);
        mockMvc.perform(post("/api/mfa/disable")
                        .with(user("testuser").roles("USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badDisable)))
                .andExpect(status().isUnauthorized());

        // Attempt disable with correct password -> Succeeds
        MfaDisableRequest goodDisable = new MfaDisableRequest("User@123456", null);
        mockMvc.perform(post("/api/mfa/disable")
                        .with(user("testuser").roles("USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(goodDisable)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("successfully disabled")));

        UserMfaSettings updated = userMfaSettingsRepository.findByUserId(testUser.getId()).orElseThrow();
        assertThat(updated.isMfaEnabled()).isFalse();
    }

    @Test
    @DisplayName("9. Admin MFA visibility and secure reset revokes user MFA and active sessions")
    void testAdminMfaVisibilityAndReset() throws Exception {
        // Enable MFA for testuser
        String secret = totpService.generateSecretKey();
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(testUser.getId()).orElse(new UserMfaSettings());
        settings.setUser(testUser);
        settings.setMfaEnabled(true);
        settings.setEncryptedSecret(cryptoUtils.encrypt(secret));
        settings.setEnrolledAt(java.time.Instant.now());
        userMfaSettingsRepository.save(settings);

        // 1. Admin views all users' MFA status
        mockMvc.perform(get("/api/admin/mfa/users")
                        .with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(2))));

        // 2. Non-admin cannot access admin endpoint
        mockMvc.perform(get("/api/admin/mfa/users")
                        .with(user("testuser").roles("USER")))
                .andExpect(status().isForbidden());

        // 3. Admin resets testuser MFA
        mockMvc.perform(post("/api/admin/mfa/users/" + testUser.getId() + "/reset")
                        .with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", containsString("MFA successfully reset")));

        UserMfaSettings resetSettings = userMfaSettingsRepository.findByUserId(testUser.getId()).orElseThrow();
        assertThat(resetSettings.isMfaEnabled()).isFalse();
    }

    @Test
    @DisplayName("10. MFA lockout triggers after 5 consecutive failed attempts")
    void testMfaLockoutAfterConsecutiveFailures() throws Exception {
        String secret = totpService.generateSecretKey();
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(testUser.getId()).orElse(new UserMfaSettings());
        settings.setUser(testUser);
        settings.setMfaEnabled(true);
        settings.setEncryptedSecret(cryptoUtils.encrypt(secret));
        settings.setEnrolledAt(java.time.Instant.now());
        settings.setFailedAttempts(0);
        userMfaSettingsRepository.save(settings);

        LoginRequest loginRequest = new LoginRequest("testuser", "User@123456");
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String challengeToken = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .path("mfaChallengeToken").asText();

        // Perform 5 failed attempts
        for (int i = 1; i <= 5; i++) {
            MfaChallengeVerifyRequest badReq = new MfaChallengeVerifyRequest(challengeToken, "999999", null);
            mockMvc.perform(post("/api/mfa/challenge/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(badReq)))
                    .andExpect(status().isUnauthorized());
        }

        // 6th attempt should be blocked due to lockout
        MfaChallengeVerifyRequest badReq = new MfaChallengeVerifyRequest(challengeToken, "999999", null);
        mockMvc.perform(post("/api/mfa/challenge/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badReq)))
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.message", containsString("Too many failed MFA attempts")));
    }

    @Test
    @DisplayName("11. Challenge token replay is strictly prevented after successful verification")
    void testChallengeReplayPrevented() throws Exception {
        String secret = totpService.generateSecretKey();
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(testUser.getId()).orElse(new UserMfaSettings());
        settings.setUser(testUser);
        settings.setMfaEnabled(true);
        settings.setEncryptedSecret(cryptoUtils.encrypt(secret));
        settings.setEnrolledAt(java.time.Instant.now());
        userMfaSettingsRepository.save(settings);

        LoginRequest loginRequest = new LoginRequest("testuser", "User@123456");
        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andReturn();

        String challengeToken = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .path("mfaChallengeToken").asText();

        int currentCode = totpService.getCurrentCode(secret);
        String codeStr = String.format("%06d", currentCode);

        // First verification succeeds
        MfaChallengeVerifyRequest firstReq = new MfaChallengeVerifyRequest(challengeToken, codeStr, null);
        mockMvc.perform(post("/api/mfa/challenge/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(firstReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        // Replaying the exact same challenge token MUST fail with 400 Bad Request
        mockMvc.perform(post("/api/mfa/challenge/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(firstReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("expired or is invalid")));
    }

    @Test
    @DisplayName("12. Recovery code regeneration creates 8 new codes and invalidates all previous ones")
    void testRecoveryCodeRegenerationInvalidatesOldCodes() throws Exception {
        String secret = totpService.generateSecretKey();
        UserMfaSettings settings = userMfaSettingsRepository.findByUserId(testUser.getId()).orElse(new UserMfaSettings());
        settings.setUser(testUser);
        settings.setMfaEnabled(true);
        settings.setEncryptedSecret(cryptoUtils.encrypt(secret));
        settings.setEnrolledAt(java.time.Instant.now());
        userMfaSettingsRepository.save(settings);

        // Initial generation
        List<String> oldCodes = cryptoUtils.generateRecoveryCodes(8);
        for (String rc : oldCodes) {
            userRecoveryCodeRepository.save(new com.iam.entity.UserRecoveryCode(testUser, cryptoUtils.hashRecoveryCode(rc)));
        }

        // Regenerate
        MfaRegenerateRecoveryCodesRequest regenReq = new MfaRegenerateRecoveryCodesRequest("User@123456", null);
        MvcResult regenResult = mockMvc.perform(post("/api/mfa/recovery-codes/regenerate")
                        .with(user("testuser").roles("USER"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(regenReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(8)))
                .andReturn();

        // Verify old codes are no longer in DB
        for (String oldCode : oldCodes) {
            String hash = cryptoUtils.hashRecoveryCode(oldCode);
            boolean exists = userRecoveryCodeRepository.findByUserIdAndCodeHashAndUsedFalse(testUser.getId(), hash).isPresent();
            assertThat(exists).isFalse();
        }

        // Verify 8 valid active codes exist
        long count = userRecoveryCodeRepository.countByUserIdAndUsedFalse(testUser.getId());
        assertThat(count).isEqualTo(8);
    }
}
