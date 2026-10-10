package com.iam.oauth;

import com.iam.entity.Authority;
import com.iam.entity.Role;
import com.iam.entity.User;
import com.iam.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class JwtCustomizer implements OAuth2TokenCustomizer<JwtEncodingContext> {

    private final UserRepository userRepository;

    public JwtCustomizer(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public void customize(JwtEncodingContext context) {
        if (OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())) {
            context.getClaims().claim("aud", List.of("iam-resource-server"));

            OAuth2Authorization authorization = context.getAuthorization();
            String username = authorization != null ? authorization.getPrincipalName() : null;
            if (username == null && context.getPrincipal() != null) {
                username = context.getPrincipal().getName();
            }

            if (username != null && !AuthorizationGrantType.CLIENT_CREDENTIALS.equals(context.getAuthorizationGrantType())) {
                context.getClaims().claim("username", username);

                userRepository.findByUsername(username).ifPresent(user -> {
                    context.getClaims().claim("user_id", user.getId());
                    context.getClaims().claim("email", user.getEmail());

                    Set<String> roles = new HashSet<>();
                    Set<String> authorities = new HashSet<>();

                    if (user.getRoles() != null) {
                        for (Role role : user.getRoles()) {
                            String roleName = role.getName().startsWith("ROLE_") ? role.getName() : "ROLE_" + role.getName();
                            roles.add(roleName);
                            if (role.getAuthorities() != null) {
                                for (Authority auth : role.getAuthorities()) {
                                    authorities.add(auth.getName());
                                }
                            }
                        }
                    }

                    context.getClaims().claim("roles", roles);
                    context.getClaims().claim("authorities", authorities);
                });
            } else if (AuthorizationGrantType.CLIENT_CREDENTIALS.equals(context.getAuthorizationGrantType())) {
                // Machine-to-Machine client credentials grant
                context.getClaims().claim("roles", Collections.singletonList("ROLE_CLIENT"));
                context.getClaims().claim("client_id", context.getRegisteredClient().getClientId());
            }
        } else if (OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue())) {
            // Standard OIDC ID Token Customization
            if (!context.getClaims().build().hasClaim("auth_time")) {
                context.getClaims().claim("auth_time", Instant.now().getEpochSecond());
            }

            OAuth2Authorization authorization = context.getAuthorization();
            String username = authorization != null ? authorization.getPrincipalName() : null;
            if (username == null && context.getPrincipal() != null) {
                username = context.getPrincipal().getName();
            }

            if (username != null) {
                Set<String> authorizedScopes = context.getAuthorizedScopes();

                userRepository.findByUsername(username).ifPresent(user -> {
                    if (authorizedScopes != null && authorizedScopes.contains(OidcScopes.PROFILE)) {
                        String fullName = ((user.getFirstName() != null ? user.getFirstName() : "") + " "
                                + (user.getLastName() != null ? user.getLastName() : "")).trim();
                        context.getClaims().claim("name", fullName.isEmpty() ? user.getUsername() : fullName);
                        context.getClaims().claim("preferred_username", user.getUsername());
                        if (user.getFirstName() != null) {
                            context.getClaims().claim("given_name", user.getFirstName());
                        }
                        if (user.getLastName() != null) {
                            context.getClaims().claim("family_name", user.getLastName());
                        }
                    }

                    if (authorizedScopes != null && authorizedScopes.contains(OidcScopes.EMAIL)) {
                        context.getClaims().claim("email", user.getEmail());
                        context.getClaims().claim("email_verified", user.isEnabled());
                    }
                });
            }
        }
    }
}
