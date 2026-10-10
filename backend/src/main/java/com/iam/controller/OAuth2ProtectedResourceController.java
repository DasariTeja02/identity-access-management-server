package com.iam.controller;

import com.iam.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/oauth2/protected")
public class OAuth2ProtectedResourceController {

    @GetMapping("/user")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProtectedUserData(Authentication authentication) {
        Map<String, Object> responseData = new LinkedHashMap<>();
        responseData.put("authenticated", authentication.isAuthenticated());
        responseData.put("principalName", authentication.getName());
        responseData.put("authorities", authentication.getAuthorities());
        responseData.put("timestamp", Instant.now().toString());

        if (authentication.getPrincipal() instanceof Jwt jwt) {
            responseData.put("tokenType", "Bearer JWT");
            responseData.put("issuer", jwt.getIssuer() != null ? jwt.getIssuer().toString() : null);
            responseData.put("subject", jwt.getSubject());
            responseData.put("audience", jwt.getAudience());
            responseData.put("expiresAt", jwt.getExpiresAt() != null ? jwt.getExpiresAt().toString() : null);
            responseData.put("claims", jwt.getClaims());
        }

        return ResponseEntity.ok(ApiResponse.ok("Authorized request to protected user resource", responseData));
    }

    @GetMapping("/admin")
    @PreAuthorize("hasAuthority('SCOPE_iam.admin') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getProtectedAdminData(Authentication authentication) {
        Map<String, Object> responseData = new LinkedHashMap<>();
        responseData.put("accessLevel", "ELEVATED_ADMIN");
        responseData.put("principalName", authentication.getName());
        responseData.put("authorities", authentication.getAuthorities());
        responseData.put("serverStatus", "ALL_SYSTEMS_OPERATIONAL");

        if (authentication.getPrincipal() instanceof Jwt jwt) {
            responseData.put("subject", jwt.getSubject());
            responseData.put("claims", jwt.getClaims());
        }

        return ResponseEntity.ok(ApiResponse.ok("Authorized request to elevated admin resource", responseData));
    }
}
