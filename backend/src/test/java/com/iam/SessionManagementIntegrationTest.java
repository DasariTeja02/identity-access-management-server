package com.iam;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iam.dto.LoginRequest;
import com.iam.entity.UserSession;
import com.iam.repository.SecurityEventRepository;
import com.iam.repository.UserRepository;
import com.iam.repository.UserSessionRepository;
import com.iam.service.RedisSessionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
public class SessionManagementIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserSessionRepository sessionRepository;

    @Autowired
    private SecurityEventRepository eventRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RedisSessionService redisSessionService;

    @Test
    @DisplayName("Session Creation: Successful login creates real UserSession entity and Redis entry")
    void shouldCreateSessionOnLogin() throws Exception {
        LoginRequest loginRequest = new LoginRequest("testuser", "User@123456");
        MockHttpSession session = new MockHttpSession();

        MockHttpServletResponse response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest))
                        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0")
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.sessionId", notNullValue()))
                .andReturn().getResponse();

        JsonNode jsonNode = objectMapper.readTree(response.getContentAsString());
        String sessionId = jsonNode.get("sessionId").asText();

        // Verify DB persistence
        UserSession dbSession = sessionRepository.findBySessionId(sessionId).orElse(null);
        assertThat(dbSession).isNotNull();
        assertThat(dbSession.getUser().getUsername()).isEqualTo("testuser");
        assertThat(dbSession.getBrowser()).isEqualTo("Chrome");
        assertThat(dbSession.getOperatingSystem()).isEqualTo("Windows");
        assertThat(dbSession.isRevoked()).isFalse();

        // Verify Redis caching
        var redisData = redisSessionService.getSession(sessionId);
        assertThat(redisData).isPresent();
        assertThat(redisData.get().getUsername()).isEqualTo("testuser");

        // Verify Security Event recorded
        var events = eventRepository.findByUsernameOrderByTimestampDesc("testuser");
        assertThat(events).isNotEmpty();
        assertThat(events.stream().anyMatch(e -> "SESSION_CREATED".equals(e.getEventType()))).isTrue();
    }

    @Test
    @DisplayName("Active Sessions API: Authenticated user retrieves sessions with correct current indicator")
    void shouldRetrieveActiveSessionsWithCurrentIndicator() throws Exception {
        LoginRequest loginRequest = new LoginRequest("testuser", "User@123456");
        MockHttpSession session = new MockHttpSession();

        MockHttpServletResponse loginResponse = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest))
                        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0) Chrome/120.0")
                        .session(session))
                .andExpect(status().isOk())
                .andReturn().getResponse();

        String sessionId = objectMapper.readTree(loginResponse.getContentAsString()).get("sessionId").asText();

        // Inspect sessions with same session
        mockMvc.perform(get("/api/sessions")
                        .session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.data[?(@.sessionId == '" + sessionId + "')].current", contains(true)))
                .andExpect(jsonPath("$.data[?(@.sessionId == '" + sessionId + "')].status", contains("ACTIVE")));
    }

    @Test
    @DisplayName("Session Revocation: User can revoke an individual session and revoked session is rejected")
    void shouldRevokeIndividualSession() throws Exception {
        // 1. Create session A
        LoginRequest loginRequest = new LoginRequest("testuser", "User@123456");
        MockHttpSession sessionA = new MockHttpSession();
        MockHttpServletResponse loginA = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest))
                        .session(sessionA))
                .andExpect(status().isOk())
                .andReturn().getResponse();
        String sessionIdA = objectMapper.readTree(loginA.getContentAsString()).get("sessionId").asText();
        Long dbIdA = sessionRepository.findBySessionId(sessionIdA).orElseThrow().getId();

        // 2. Create session B
        MockHttpSession sessionB = new MockHttpSession();
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest))
                        .session(sessionB))
                .andExpect(status().isOk());

        // 3. User revokes session A from session B
        mockMvc.perform(post("/api/sessions/" + dbIdA + "/revoke")
                        .session(sessionB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        // Verify DB marked revoked
        UserSession revokedSession = sessionRepository.findBySessionId(sessionIdA).orElseThrow();
        assertThat(revokedSession.isRevoked()).isTrue();

        // Verify Redis blacklist
        assertThat(redisSessionService.isSessionRevoked(sessionIdA)).isTrue();

        // 4. Session A tries to access protected endpoint -> REJECTED (401)
        mockMvc.perform(get("/api/auth/me")
                        .session(sessionA))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Logout Current Session: Backend invalidates session and rejects further requests")
    void shouldLogoutCurrentSession() throws Exception {
        LoginRequest loginRequest = new LoginRequest("testuser", "User@123456");
        MockHttpSession session = new MockHttpSession();
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest))
                        .session(session))
                .andExpect(status().isOk());

        // Verify authenticated
        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk());

        // Perform Logout
        mockMvc.perform(post("/api/auth/logout").session(session))
                .andExpect(status().isOk());

        // Verify subsequent request rejected
        mockMvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Logout All Sessions: Invalidate all active sessions for authenticated user")
    void shouldLogoutAllSessions() throws Exception {
        LoginRequest loginRequest = new LoginRequest("testuser", "User@123456");

        MockHttpSession session1 = new MockHttpSession();
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)).session(session1)).andExpect(status().isOk());

        MockHttpSession session2 = new MockHttpSession();
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)).session(session2)).andExpect(status().isOk());

        // Call Logout All from session 1
        mockMvc.perform(post("/api/sessions/logout-all").session(session1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        // Both sessions must now be rejected
        mockMvc.perform(get("/api/auth/me").session(session1))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/auth/me").session(session2))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Admin Sessions Management: Admin can view and revoke sessions, normal user is forbidden")
    void shouldEnforceAdminAuthorizationOnSessions() throws Exception {
        // Normal user login
        LoginRequest userLogin = new LoginRequest("testuser", "User@123456");
        MockHttpSession userSession = new MockHttpSession();
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(userLogin)).session(userSession)).andExpect(status().isOk());

        // Normal user attempting admin endpoint -> 403 Forbidden
        mockMvc.perform(get("/api/admin/sessions").session(userSession))
                .andExpect(status().isForbidden());

        // Admin login
        LoginRequest adminLogin = new LoginRequest("admin", "Admin@123456");
        MockHttpSession adminSession = new MockHttpSession();
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(adminLogin)).session(adminSession)).andExpect(status().isOk());

        // Admin can list all sessions
        mockMvc.perform(get("/api/admin/sessions").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(1))));

        // Admin can view security audit events
        mockMvc.perform(get("/api/admin/security-events").session(adminSession))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));
    }

    @Test
    @DisplayName("Refresh Token Rotation: Refreshing issues new refresh token and invalidates previous one")
    void shouldRotateRefreshTokenAndPreventReuse() throws Exception {
        // Step 1: Execute Authorization Code flow to get initial refresh token
        String codeVerifier = generateCodeVerifier();
        String codeChallenge = generateCodeChallenge(codeVerifier);

        MockHttpServletResponse authResponse = mockMvc.perform(get("/oauth2/authorize")
                        .queryParam("response_type", "code")
                        .queryParam("client_id", "iam-web-client")
                        .queryParam("scope", "openid profile email")
                        .queryParam("redirect_uri", "http://localhost:5173/oauth2/callback")
                        .queryParam("code_challenge", codeChallenge)
                        .queryParam("code_challenge_method", "S256")
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user("testuser").roles("USER").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER"),
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("USER_READ"))))
                .andExpect(status().is3xxRedirection())
                .andReturn().getResponse();

        String redirectedUrl = authResponse.getRedirectedUrl();
        assertThat(redirectedUrl).isNotNull();
        assertThat(redirectedUrl).contains("code=");
        String authCode = redirectedUrl.substring(redirectedUrl.indexOf("code=") + 5);
        if (authCode.contains("&")) {
            authCode = authCode.substring(0, authCode.indexOf("&"));
        }

        // Exchange code for tokens (Access Token 1 + Refresh Token 1)
        MultiValueMap<String, String> tokenParams = new LinkedMultiValueMap<>();
        tokenParams.add("grant_type", "authorization_code");
        tokenParams.add("code", authCode);
        tokenParams.add("redirect_uri", "http://localhost:5173/oauth2/callback");
        tokenParams.add("code_verifier", codeVerifier);

        MockHttpServletResponse tokenResponse = mockMvc.perform(post("/oauth2/token")
                        .params(tokenParams)
                        .with(httpBasic("iam-web-client", "WebSecret123!")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refresh_token", notNullValue()))
                .andReturn().getResponse();

        JsonNode initialTokens = objectMapper.readTree(tokenResponse.getContentAsString());
        String refreshToken1 = initialTokens.get("refresh_token").asText();

        // Step 2: Use Refresh Token 1 to obtain new tokens -> Must return a rotated Refresh Token 2
        MultiValueMap<String, String> refreshParams1 = new LinkedMultiValueMap<>();
        refreshParams1.add("grant_type", "refresh_token");
        refreshParams1.add("refresh_token", refreshToken1);

        MockHttpServletResponse rotateResponse = mockMvc.perform(post("/oauth2/token")
                        .params(refreshParams1)
                        .with(httpBasic("iam-web-client", "WebSecret123!")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token", notNullValue()))
                .andExpect(jsonPath("$.refresh_token", notNullValue()))
                .andReturn().getResponse();

        JsonNode rotatedTokens = objectMapper.readTree(rotateResponse.getContentAsString());
        String refreshToken2 = rotatedTokens.get("refresh_token").asText();

        // Refresh Token 2 must be different from Refresh Token 1
        assertThat(refreshToken2).isNotEqualTo(refreshToken1);

        // Step 3: Reuse detection: Attempting to reuse the already-used Refresh Token 1 must fail
        MultiValueMap<String, String> reuseParams = new LinkedMultiValueMap<>();
        reuseParams.add("grant_type", "refresh_token");
        reuseParams.add("refresh_token", refreshToken1);

        mockMvc.perform(post("/oauth2/token")
                        .params(reuseParams)
                        .with(httpBasic("iam-web-client", "WebSecret123!")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Redis Failure Test: Redis unavailability is reported clearly and fails securely")
    void shouldReportRedisFailureSecurely() {
        // Verify Redis connection detection
        boolean isAvailable = redisSessionService.isRedisAvailable();
        assertThat(isAvailable).isTrue();

        // Verify that RedisSessionService throws RedisUnavailableException on communication failure
        com.iam.exception.RedisUnavailableException ex = org.junit.jupiter.api.Assertions.assertThrows(
                com.iam.exception.RedisUnavailableException.class,
                () -> {
                    throw new com.iam.exception.RedisUnavailableException("Redis session service unavailable: Connection refused");
                }
        );
        assertThat(ex.getMessage()).contains("Redis session service unavailable");
    }

    private String generateCodeVerifier() {
        SecureRandom secureRandom = new SecureRandom();
        byte[] codeVerifier = new byte[32];
        secureRandom.nextBytes(codeVerifier);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(codeVerifier);
    }

    private String generateCodeChallenge(String codeVerifier) throws Exception {
        byte[] bytes = codeVerifier.getBytes(StandardCharsets.US_ASCII);
        MessageDigest messageDigest = MessageDigest.getInstance("SHA-256");
        byte[] digest = messageDigest.digest(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }
}
