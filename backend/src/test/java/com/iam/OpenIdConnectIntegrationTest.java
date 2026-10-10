package com.iam;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
public class OpenIdConnectIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtDecoder jwtDecoder;

    @Test
    @DisplayName("OIDC Discovery: Should expose standard OpenID Provider Configuration metadata at /.well-known/openid-configuration")
    void shouldExposeOidcDiscoveryEndpoint() throws Exception {
        mockMvc.perform(get("/.well-known/openid-configuration"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.issuer", is("http://localhost:8080")))
                .andExpect(jsonPath("$.authorization_endpoint", is("http://localhost:8080/oauth2/authorize")))
                .andExpect(jsonPath("$.token_endpoint", is("http://localhost:8080/oauth2/token")))
                .andExpect(jsonPath("$.jwks_uri", is("http://localhost:8080/oauth2/jwks")))
                .andExpect(jsonPath("$.userinfo_endpoint", is("http://localhost:8080/userinfo")))
                .andExpect(jsonPath("$.scopes_supported", hasItem("openid")))
                .andExpect(jsonPath("$.response_types_supported", hasItem("code")))
                .andExpect(jsonPath("$.id_token_signing_alg_values_supported", hasItem("RS256")));
    }

    @Test
    @DisplayName("UserInfo Endpoint: Should reject unauthenticated requests without token with 401 Unauthorized")
    void shouldRejectUserInfoWithoutToken() throws Exception {
        mockMvc.perform(get("/userinfo"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("UserInfo Endpoint: Should reject invalid Bearer token with 401 Unauthorized")
    void shouldRejectUserInfoWithInvalidToken() throws Exception {
        mockMvc.perform(get("/userinfo")
                .header("Authorization", "Bearer invalid-token-xyz-12345"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("OAuth Flow without 'openid' scope: Should NOT issue an ID Token")
    void oauthFlowWithoutOpenidScopeDoesNotIssueIdToken() throws Exception {
        String codeVerifier = generateCodeVerifier();
        String codeChallenge = generateCodeChallenge(codeVerifier);

        MockHttpServletResponse authResponse = mockMvc.perform(get("/oauth2/authorize")
                        .queryParam("response_type", "code")
                        .queryParam("client_id", "iam-web-client")
                        .queryParam("scope", "read write")
                        .queryParam("redirect_uri", "http://localhost:5173/oauth2/callback")
                        .queryParam("code_challenge", codeChallenge)
                        .queryParam("code_challenge_method", "S256")
                        .with(user("testuser").roles("USER")))
                .andExpect(status().is3xxRedirection())
                .andReturn().getResponse();

        String redirectedUrl = authResponse.getRedirectedUrl();
        assertThat(redirectedUrl).contains("code=");
        String code = extractQueryParam(redirectedUrl, "code");

        MultiValueMap<String, String> tokenParams = new LinkedMultiValueMap<>();
        tokenParams.add("grant_type", "authorization_code");
        tokenParams.add("client_id", "iam-web-client");
        tokenParams.add("code", code);
        tokenParams.add("redirect_uri", "http://localhost:5173/oauth2/callback");
        tokenParams.add("code_verifier", codeVerifier);

        mockMvc.perform(post("/oauth2/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .params(tokenParams))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token", notNullValue()))
                .andExpect(jsonPath("$.id_token").doesNotExist());
    }

    @Test
    @DisplayName("End-to-End OIDC Flow: Full Authorization Code + PKCE + Nonce -> ID Token & UserInfo Endpoint")
    void fullOidcEndToEndFlowWithPkceAndNonce() throws Exception {
        String codeVerifier = generateCodeVerifier();
        String codeChallenge = generateCodeChallenge(codeVerifier);
        String expectedNonce = "oidc-security-nonce-" + System.currentTimeMillis();

        // 1. Authorize with openid, profile, email scopes and nonce
        MockHttpServletResponse authResponse = mockMvc.perform(get("/oauth2/authorize")
                        .queryParam("response_type", "code")
                        .queryParam("client_id", "iam-web-client")
                        .queryParam("scope", "openid profile email")
                        .queryParam("redirect_uri", "http://localhost:5173/oauth2/callback")
                        .queryParam("code_challenge", codeChallenge)
                        .queryParam("code_challenge_method", "S256")
                        .queryParam("nonce", expectedNonce)
                        .with(user("testuser").roles("USER")))
                .andExpect(status().is3xxRedirection())
                .andReturn().getResponse();

        String redirectedUrl = authResponse.getRedirectedUrl();
        assertThat(redirectedUrl).contains("code=");
        String code = extractQueryParam(redirectedUrl, "code");

        // 2. Exchange Authorization Code for Access Token AND ID Token
        MultiValueMap<String, String> tokenParams = new LinkedMultiValueMap<>();
        tokenParams.add("grant_type", "authorization_code");
        tokenParams.add("client_id", "iam-web-client");
        tokenParams.add("code", code);
        tokenParams.add("redirect_uri", "http://localhost:5173/oauth2/callback");
        tokenParams.add("code_verifier", codeVerifier);

        String tokenResponseBody = mockMvc.perform(post("/oauth2/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .params(tokenParams))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token", notNullValue()))
                .andExpect(jsonPath("$.id_token", notNullValue()))
                .andExpect(jsonPath("$.token_type", is("Bearer")))
                .andReturn().getResponse().getContentAsString();

        JsonNode jsonNode = objectMapper.readTree(tokenResponseBody);
        String accessToken = jsonNode.get("access_token").asText();
        String idTokenString = jsonNode.get("id_token").asText();

        // 3. Verify ID Token claims and signatures
        Jwt idToken = jwtDecoder.decode(idTokenString);
        assertThat(idToken.getSubject()).isEqualTo("testuser");
        assertThat(idToken.getIssuer().toString()).isEqualTo("http://localhost:8080");
        assertThat(idToken.getAudience()).contains("iam-web-client");
        assertThat(idToken.getClaimAsString("nonce")).isEqualTo(expectedNonce);
        assertThat(idToken.getClaims()).containsKey("auth_time");
        assertThat(idToken.getClaimAsString("email")).isEqualTo("testuser@iam.local");
        assertThat(idToken.getClaimAsBoolean("email_verified")).isTrue();
        assertThat(idToken.getClaimAsString("name")).contains("Demo User");
        assertThat(idToken.getClaimAsString("preferred_username")).isEqualTo("testuser");

        // 4. Call UserInfo Endpoint using Access Token
        mockMvc.perform(get("/userinfo")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sub", is("testuser")))
                .andExpect(jsonPath("$.name", is("Demo User")))
                .andExpect(jsonPath("$.preferred_username", is("testuser")))
                .andExpect(jsonPath("$.given_name", is("Demo")))
                .andExpect(jsonPath("$.family_name", is("User")))
                .andExpect(jsonPath("$.email", is("testuser@iam.local")))
                .andExpect(jsonPath("$.email_verified", is(true)));
    }

    @Test
    @DisplayName("UserInfo Scope Scoping: Should only return email when email scope is granted")
    void userInfoRespectsGrantedScopes() throws Exception {
        String codeVerifier = generateCodeVerifier();
        String codeChallenge = generateCodeChallenge(codeVerifier);

        // Authorize with only openid and email (NO profile)
        MockHttpServletResponse authResponse = mockMvc.perform(get("/oauth2/authorize")
                        .queryParam("response_type", "code")
                        .queryParam("client_id", "iam-web-client")
                        .queryParam("scope", "openid email")
                        .queryParam("redirect_uri", "http://localhost:5173/oauth2/callback")
                        .queryParam("code_challenge", codeChallenge)
                        .queryParam("code_challenge_method", "S256")
                        .with(user("testuser").roles("USER")))
                .andExpect(status().is3xxRedirection())
                .andReturn().getResponse();

        String code = extractQueryParam(authResponse.getRedirectedUrl(), "code");

        MultiValueMap<String, String> tokenParams = new LinkedMultiValueMap<>();
        tokenParams.add("grant_type", "authorization_code");
        tokenParams.add("client_id", "iam-web-client");
        tokenParams.add("code", code);
        tokenParams.add("redirect_uri", "http://localhost:5173/oauth2/callback");
        tokenParams.add("code_verifier", codeVerifier);

        String tokenResponseBody = mockMvc.perform(post("/oauth2/token")
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .params(tokenParams))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        JsonNode jsonNode = objectMapper.readTree(tokenResponseBody);
        String accessToken = jsonNode.get("access_token").asText();

        // UserInfo should contain sub and email, but NOT name or family_name
        mockMvc.perform(get("/userinfo")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sub", is("testuser")))
                .andExpect(jsonPath("$.email", is("testuser@iam.local")))
                .andExpect(jsonPath("$.email_verified", is(true)))
                .andExpect(jsonPath("$.given_name").doesNotExist())
                .andExpect(jsonPath("$.family_name").doesNotExist());
    }

    @Test
    @DisplayName("UserInfo Scope Enforcement: Token without openid scope should be rejected")
    void userInfoRejectsTokenWithoutOpenidScope() throws Exception {
        // Request token via Client Credentials (scopes: read, write, iam.admin - NO openid)
        String tokenResponse = mockMvc.perform(post("/oauth2/token")
                        .with(httpBasic("backend-service", "Secret123!"))
                        .param("grant_type", "client_credentials")
                        .param("scope", "read write"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        String accessToken = objectMapper.readTree(tokenResponse).get("access_token").asText();

        // Calling UserInfo with a token lacking 'openid' scope must fail (insufficient_scope / 401 or 403)
        mockMvc.perform(get("/userinfo")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().is4xxClientError());
    }

    // PKCE Helper utilities
    private String generateCodeVerifier() {
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String generateCodeChallenge(String verifier) throws Exception {
        byte[] bytes = verifier.getBytes(StandardCharsets.US_ASCII);
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] digest = md.digest(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }

    private String extractQueryParam(String url, String paramName) {
        String query = url.substring(url.indexOf('?') + 1);
        for (String pair : query.split("&")) {
            String[] parts = pair.split("=");
            if (parts[0].equals(paramName)) {
                return parts[1];
            }
        }
        return null;
    }
}
