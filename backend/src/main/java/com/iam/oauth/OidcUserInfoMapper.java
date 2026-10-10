package com.iam.oauth;

import com.iam.repository.UserRepository;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.server.authorization.oidc.authentication.OidcUserInfoAuthenticationContext;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

/**
 * Standard OpenID Connect UserInfo mapper.
 * Populates OIDC identity claims directly from the existing IAM PostgreSQL User repository
 * based strictly on the authorized scopes (openid, profile, email).
 */
public class OidcUserInfoMapper implements Function<OidcUserInfoAuthenticationContext, OidcUserInfo> {

    private final UserRepository userRepository;

    public OidcUserInfoMapper(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public OidcUserInfo apply(OidcUserInfoAuthenticationContext context) {
        String username = context.getAuthorization().getPrincipalName();
        Set<String> scopes = context.getAccessToken() != null && context.getAccessToken().getScopes() != null
                ? context.getAccessToken().getScopes()
                : Collections.emptySet();

        Map<String, Object> claims = new HashMap<>();

        // 1. Mandatory standard OIDC claim
        claims.put(IdTokenClaimNames.SUB, username);

        // 2. Fetch user from the existing IAM PostgreSQL repository
        userRepository.findByUsername(username).ifPresent(user -> {
            // Profile scope claims
            if (scopes.contains(OidcScopes.PROFILE)) {
                String fullName = ((user.getFirstName() != null ? user.getFirstName() : "") + " "
                        + (user.getLastName() != null ? user.getLastName() : "")).trim();
                claims.put("name", fullName.isEmpty() ? user.getUsername() : fullName);
                claims.put("preferred_username", user.getUsername());
                if (user.getFirstName() != null) {
                    claims.put("given_name", user.getFirstName());
                }
                if (user.getLastName() != null) {
                    claims.put("family_name", user.getLastName());
                }
                if (user.getUpdatedAt() != null) {
                    claims.put("updated_at", user.getUpdatedAt().getEpochSecond());
                }
            }

            // Email scope claims
            if (scopes.contains(OidcScopes.EMAIL)) {
                claims.put("email", user.getEmail());
                claims.put("email_verified", user.isEnabled());
            }
        });

        return new OidcUserInfo(claims);
    }
}
