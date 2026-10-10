package com.iam.controller;

import com.iam.dto.ApiResponse;
import com.iam.entity.OAuth2Client;
import com.iam.repository.OAuth2ClientRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/oauth2")
public class OAuth2InfoController {

    private final OAuth2ClientRepository clientRepository;

    @Value("${iam.oauth2.issuer:http://localhost:8080}")
    private String issuer;

    public OAuth2InfoController(OAuth2ClientRepository clientRepository) {
        this.clientRepository = clientRepository;
    }

    @GetMapping("/server-info")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getServerInfo() {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("issuer", issuer);
        info.put("authorizationEndpoint", issuer + "/oauth2/authorize");
        info.put("tokenEndpoint", issuer + "/oauth2/token");
        info.put("jwksUri", issuer + "/oauth2/jwks");
        info.put("userinfoEndpoint", issuer + "/userinfo");
        info.put("openidConfigurationEndpoint", issuer + "/.well-known/openid-configuration");
        info.put("revocationEndpoint", issuer + "/oauth2/revoke");
        info.put("introspectionEndpoint", issuer + "/oauth2/introspect");
        info.put("grantTypesSupported", List.of("authorization_code", "client_credentials", "refresh_token"));
        info.put("responseTypesSupported", List.of("code"));
        info.put("tokenEndpointAuthMethodsSupported", List.of("client_secret_basic", "client_secret_post", "none"));
        info.put("scopesSupported", List.of("openid", "profile", "email", "read", "write", "iam.admin"));
        info.put("claimsSupported", List.of("sub", "iss", "aud", "exp", "iat", "auth_time", "nonce", "name", "given_name", "family_name", "preferred_username", "email", "email_verified"));
        info.put("codeChallengeMethodsSupported", List.of("S256"));
        info.put("tokenFormat", "JWT (Self-Contained)");
        info.put("signingAlgorithm", "RS256 (2048-bit RSA KeyPair)");

        return ResponseEntity.ok(ApiResponse.ok("OAuth2 and OpenID Connect Server Metadata retrieved", info));
    }

    @GetMapping("/clients")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getRegisteredClients() {
        List<OAuth2Client> clients = clientRepository.findAll();

        List<Map<String, Object>> clientDtos = clients.stream().map(c -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", c.getId());
            map.put("clientId", c.getClientId());
            map.put("clientName", c.getClientName());
            map.put("grantTypes", Arrays.asList(c.getAuthorizationGrantTypes().split(",")));
            map.put("authMethods", Arrays.asList(c.getClientAuthenticationMethods().split(",")));
            map.put("scopes", Arrays.asList(c.getScopes().split(",")));
            map.put("redirectUris", c.getRedirectUris() != null ? Arrays.asList(c.getRedirectUris().split(",")) : Collections.emptyList());
            map.put("accessTokenTtlSeconds", c.getAccessTokenTimeToLiveSeconds());
            map.put("refreshTokenTtlSeconds", c.getRefreshTokenTimeToLiveSeconds());
            map.put("requirePkce", c.isRequireProofKeyForCodeExchange());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.ok("Registered clients retrieved successfully", clientDtos));
    }
}
