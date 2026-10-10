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
public class OAuth2AuthorizationServerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtDecoder jwtDecoder;

    @Test
    @DisplayName("JWKS Endpoint: Should expose public RSA JWK keys at /oauth2/jwks")
    void shouldExposeJwksEndpoint() throws Exception {
        mockMvc.perform(get("/oauth2/jwks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keys", hasSize(greaterThan(0))))
                .andExpect(jsonPath("$.keys[0].kty", is("RSA")))
                .andExpect(jsonPath("$.keys[0].use", is("sig")));
    }

    @Test
    @DisplayName("OAuth2 Server Metadata: Should expose discovery metadata")
    void shouldExposeOAuth2ServerInfo() throws Exception {
        mockMvc.perform(get("/api/oauth2/server-info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.authorizationEndpoint", containsString("/oauth2/authorize")))
                .andExpect(jsonPath("$.data.tokenEndpoint", containsString("/oauth2/token")))
                .andExpect(jsonPath("$.data.grantTypesSupported", hasItems("client_credentials", "authorization_code", "refresh_token")));
    }

    @Test
    @DisplayName("Registered Clients: Should return list of registered clients without secrets")
    void shouldReturnRegisteredClientsDirectory() throws Exception {
        mockMvc.perform(get("/api/oauth2/clients"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(greaterThanOrEqualTo(2))))
                .andExpect(jsonPath("$.data[?(@.clientId == 'backend-service')]", notNullValue()))
                .andExpect(jsonPath("$.data[?(@.clientId == 'iam-web-client')]", notNullValue()));
    }

    @Test
    @DisplayName("Client Credentials Flow: Should issue JWT access token with client_credentials grant")
    void shouldIssueTokenWithClientCredentialsGrant() throws Exception {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "client_credentials");
        params.add("scope", "read write");

        MockHttpServletResponse response = mockMvc.perform(post("/oauth2/token")
                        .params(params)
                        .with(httpBasic("backend-service", "Secret123!")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token", notNullValue()))
                .andExpect(jsonPath("$.token_type", is("Bearer")))
                .andExpect(jsonPath("$.expires_in", both(greaterThan(1700)).and(lessThanOrEqualTo(1800))))
                .andReturn().getResponse();

        JsonNode jsonNode = objectMapper.readTree(response.getContentAsString());
        String accessToken = jsonNode.get("access_token").asText();

        // Validate JWT structure and custom claims
        Jwt jwt = jwtDecoder.decode(accessToken);
        assertThat(jwt.getSubject()).isEqualTo("backend-service");
        assertThat(jwt.getClaimAsStringList("aud")).contains("iam-resource-server");
        assertThat(jwt.getClaimAsStringList("roles")).contains("ROLE_CLIENT");
        assertThat(jwt.getClaimAsString("client_id")).isEqualTo("backend-service");

        // Verify calling protected resource with this token
        mockMvc.perform(get("/api/oauth2/protected/user")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.principalName", is("backend-service")));
    }

    @Test
    @DisplayName("Client Credentials Flow: Should reject invalid client secret")
    void shouldRejectInvalidClientSecret() throws Exception {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "client_credentials");

        mockMvc.perform(post("/oauth2/token")
                        .params(params)
                        .with(httpBasic("backend-service", "WrongSecret!")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Resource Server: Should reject protected API requests with missing token")
    void shouldRejectMissingBearerToken() throws Exception {
        mockMvc.perform(get("/api/oauth2/protected/user"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Resource Server: Should reject invalid/malformed Bearer token")
    void shouldRejectMalformedBearerToken() throws Exception {
        mockMvc.perform(get("/api/oauth2/protected/user")
                        .header("Authorization", "Bearer invalid.fake.token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Authorization Code Flow (with PKCE): Full end-to-end authorization code to token exchange")
    void shouldCompleteAuthorizationCodeFlowWithPkce() throws Exception {
        // 1. Generate PKCE Code Verifier & Challenge
        String codeVerifier = generateCodeVerifier();
        String codeChallenge = generateCodeChallenge(codeVerifier);

        // 2. Request Authorization Code as authenticated user (testuser)
        MockHttpServletResponse authResponse = mockMvc.perform(get("/oauth2/authorize")
                        .queryParam("response_type", "code")
                        .queryParam("client_id", "iam-web-client")
                        .queryParam("scope", "profile read")
                        .queryParam("redirect_uri", "http://localhost:5173/oauth2/callback")
                        .queryParam("code_challenge", codeChallenge)
                        .queryParam("code_challenge_method", "S256")
                        .with(user("testuser").roles("USER").authorities(
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_USER"),
                                new org.springframework.security.core.authority.SimpleGrantedAuthority("USER_READ"))))
                .andExpect(status().is3xxRedirection())
                .andReturn().getResponse();

        String redirectedUrl = authResponse.getRedirectedUrl();
        assertThat(redirectedUrl).isNotNull();
        assertThat(redirectedUrl).contains("code=");

        // Extract authorization code from redirect URL
        String authCode = redirectedUrl.substring(redirectedUrl.indexOf("code=") + 5);
        if (authCode.contains("&")) {
            authCode = authCode.substring(0, authCode.indexOf("&"));
        }

        // 3. Exchange Authorization Code for Access Token and Refresh Token
        MultiValueMap<String, String> tokenParams = new LinkedMultiValueMap<>();
        tokenParams.add("grant_type", "authorization_code");
        tokenParams.add("code", authCode);
        tokenParams.add("redirect_uri", "http://localhost:5173/oauth2/callback");
        tokenParams.add("code_verifier", codeVerifier);

        MockHttpServletResponse tokenResponse = mockMvc.perform(post("/oauth2/token")
                        .params(tokenParams)
                        .with(httpBasic("iam-web-client", "WebSecret123!")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token", notNullValue()))
                .andExpect(jsonPath("$.refresh_token", notNullValue()))
                .andExpect(jsonPath("$.token_type", is("Bearer")))
                .andReturn().getResponse();

        JsonNode tokenNode = objectMapper.readTree(tokenResponse.getContentAsString());
        String accessToken = tokenNode.get("access_token").asText();
        String refreshToken = tokenNode.get("refresh_token").asText();

        // 4. Validate user JWT custom claims
        Jwt jwt = jwtDecoder.decode(accessToken);
        assertThat(jwt.getSubject()).isEqualTo("testuser");
        assertThat(jwt.getClaimAsString("username")).isEqualTo("testuser");
        assertThat(jwt.getClaimAsStringList("roles")).contains("ROLE_USER");
        assertThat(jwt.getClaimAsStringList("authorities")).contains("USER_READ");

        // 5. Test protected endpoint with user Bearer JWT
        mockMvc.perform(get("/api/oauth2/protected/user")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.principalName", is("testuser")));

        // 6. Test Refresh Token Flow: exchange refresh token for a new access token
        MultiValueMap<String, String> refreshParams = new LinkedMultiValueMap<>();
        refreshParams.add("grant_type", "refresh_token");
        refreshParams.add("refresh_token", refreshToken);

        MockHttpServletResponse refreshedResponse = mockMvc.perform(post("/oauth2/token")
                        .params(refreshParams)
                        .with(httpBasic("iam-web-client", "WebSecret123!")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token", notNullValue()))
                .andReturn().getResponse();

        JsonNode refreshedNode = objectMapper.readTree(refreshedResponse.getContentAsString());
        String newAccessToken = refreshedNode.get("access_token").asText();
        assertThat(newAccessToken).isNotEmpty();

        // Validate the refreshed token
        Jwt newJwt = jwtDecoder.decode(newAccessToken);
        assertThat(newJwt.getSubject()).isEqualTo("testuser");
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
