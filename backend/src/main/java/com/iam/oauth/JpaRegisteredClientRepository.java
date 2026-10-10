package com.iam.oauth;

import com.iam.entity.OAuth2Client;
import com.iam.repository.OAuth2ClientRepository;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.OAuth2TokenFormat;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Component
public class JpaRegisteredClientRepository implements RegisteredClientRepository {

    private final OAuth2ClientRepository clientRepository;

    public JpaRegisteredClientRepository(OAuth2ClientRepository clientRepository) {
        this.clientRepository = clientRepository;
    }

    @Override
    @Transactional
    public void save(RegisteredClient registeredClient) {
        OAuth2Client entity = toEntity(registeredClient);
        clientRepository.save(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public RegisteredClient findById(String id) {
        return clientRepository.findById(id)
                .map(this::toRegisteredClient)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public RegisteredClient findByClientId(String clientId) {
        return clientRepository.findByClientId(clientId)
                .map(this::toRegisteredClient)
                .orElse(null);
    }

    public List<RegisteredClient> findAll() {
        return clientRepository.findAll().stream()
                .map(this::toRegisteredClient)
                .collect(Collectors.toList());
    }

    private RegisteredClient toRegisteredClient(OAuth2Client entity) {
        Set<ClientAuthenticationMethod> clientAuthenticationMethods = StringUtils.commaDelimitedListToSet(entity.getClientAuthenticationMethods()).stream()
                .map(ClientAuthenticationMethod::new)
                .collect(Collectors.toSet());

        Set<AuthorizationGrantType> authorizationGrantTypes = StringUtils.commaDelimitedListToSet(entity.getAuthorizationGrantTypes()).stream()
                .map(AuthorizationGrantType::new)
                .collect(Collectors.toSet());

        Set<String> redirectUris = StringUtils.commaDelimitedListToSet(entity.getRedirectUris());
        Set<String> postLogoutRedirectUris = StringUtils.commaDelimitedListToSet(entity.getPostLogoutRedirectUris());
        Set<String> scopes = StringUtils.commaDelimitedListToSet(entity.getScopes());

        ClientSettings clientSettings = ClientSettings.builder()
                .requireAuthorizationConsent(entity.isRequireAuthorizationConsent())
                .requireProofKey(entity.isRequireProofKeyForCodeExchange())
                .build();

        TokenSettings tokenSettings = TokenSettings.builder()
                .accessTokenFormat(OAuth2TokenFormat.SELF_CONTAINED)
                .accessTokenTimeToLive(Duration.ofSeconds(entity.getAccessTokenTimeToLiveSeconds()))
                .refreshTokenTimeToLive(Duration.ofSeconds(entity.getRefreshTokenTimeToLiveSeconds()))
                .reuseRefreshTokens(entity.isReuseRefreshTokens())
                .build();

        RegisteredClient.Builder builder = RegisteredClient.withId(entity.getId())
                .clientId(entity.getClientId())
                .clientIdIssuedAt(entity.getClientIdIssuedAt())
                .clientSecret(entity.getClientSecret())
                .clientSecretExpiresAt(entity.getClientSecretExpiresAt())
                .clientName(entity.getClientName())
                .clientAuthenticationMethods(m -> m.addAll(clientAuthenticationMethods))
                .authorizationGrantTypes(g -> g.addAll(authorizationGrantTypes))
                .redirectUris(r -> r.addAll(redirectUris))
                .postLogoutRedirectUris(p -> p.addAll(postLogoutRedirectUris))
                .scopes(s -> s.addAll(scopes))
                .clientSettings(clientSettings)
                .tokenSettings(tokenSettings);

        return builder.build();
    }

    private OAuth2Client toEntity(RegisteredClient registeredClient) {
        OAuth2Client entity = new OAuth2Client();
        entity.setId(registeredClient.getId());
        entity.setClientId(registeredClient.getClientId());
        entity.setClientIdIssuedAt(registeredClient.getClientIdIssuedAt());
        entity.setClientSecret(registeredClient.getClientSecret());
        entity.setClientSecretExpiresAt(registeredClient.getClientSecretExpiresAt());
        entity.setClientName(registeredClient.getClientName());

        List<String> clientAuthMethods = registeredClient.getClientAuthenticationMethods().stream()
                .map(ClientAuthenticationMethod::getValue)
                .collect(Collectors.toList());
        entity.setClientAuthenticationMethods(StringUtils.collectionToCommaDelimitedString(clientAuthMethods));

        List<String> authGrantTypes = registeredClient.getAuthorizationGrantTypes().stream()
                .map(AuthorizationGrantType::getValue)
                .collect(Collectors.toList());
        entity.setAuthorizationGrantTypes(StringUtils.collectionToCommaDelimitedString(authGrantTypes));

        entity.setRedirectUris(StringUtils.collectionToCommaDelimitedString(registeredClient.getRedirectUris()));
        entity.setPostLogoutRedirectUris(StringUtils.collectionToCommaDelimitedString(registeredClient.getPostLogoutRedirectUris()));
        entity.setScopes(StringUtils.collectionToCommaDelimitedString(registeredClient.getScopes()));

        entity.setRequireAuthorizationConsent(registeredClient.getClientSettings().isRequireAuthorizationConsent());
        entity.setRequireProofKeyForCodeExchange(registeredClient.getClientSettings().isRequireProofKey());

        entity.setAccessTokenTimeToLiveSeconds(registeredClient.getTokenSettings().getAccessTokenTimeToLive().getSeconds());
        entity.setRefreshTokenTimeToLiveSeconds(registeredClient.getTokenSettings().getRefreshTokenTimeToLive().getSeconds());
        entity.setReuseRefreshTokens(registeredClient.getTokenSettings().isReuseRefreshTokens());

        return entity;
    }
}
