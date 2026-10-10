package com.iam.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(
    name = "oauth2_registered_clients",
    indexes = {
        @Index(name = "idx_oauth2_client_id", columnList = "client_id")
    }
)
public class OAuth2Client {

    @Id
    @Column(length = 100)
    private String id;

    @Column(name = "client_id", nullable = false, unique = true, length = 100)
    private String clientId;

    @Column(name = "client_id_issued_at")
    private Instant clientIdIssuedAt = Instant.now();

    @Column(name = "client_secret", length = 255)
    private String clientSecret;

    @Column(name = "client_secret_expires_at")
    private Instant clientSecretExpiresAt;

    @Column(name = "client_name", nullable = false, length = 200)
    private String clientName;

    @Column(name = "client_authentication_methods", length = 1000)
    private String clientAuthenticationMethods;

    @Column(name = "authorization_grant_types", length = 1000)
    private String authorizationGrantTypes;

    @Column(name = "redirect_uris", length = 1000)
    private String redirectUris;

    @Column(name = "post_logout_redirect_uris", length = 1000)
    private String postLogoutRedirectUris;

    @Column(name = "scopes", length = 1000)
    private String scopes;

    @Column(name = "require_authorization_consent")
    private boolean requireAuthorizationConsent = false;

    @Column(name = "require_proof_key_for_code_exchange")
    private boolean requireProofKeyForCodeExchange = true;

    @Column(name = "access_token_time_to_live_seconds")
    private long accessTokenTimeToLiveSeconds = 900; // 15 mins

    @Column(name = "refresh_token_time_to_live_seconds")
    private long refreshTokenTimeToLiveSeconds = 2592000; // 30 days

    @Column(name = "reuse_refresh_tokens")
    private boolean reuseRefreshTokens = true;

    public OAuth2Client() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public Instant getClientIdIssuedAt() {
        return clientIdIssuedAt;
    }

    public void setClientIdIssuedAt(Instant clientIdIssuedAt) {
        this.clientIdIssuedAt = clientIdIssuedAt;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
        this.clientSecret = clientSecret;
    }

    public Instant getClientSecretExpiresAt() {
        return clientSecretExpiresAt;
    }

    public void setClientSecretExpiresAt(Instant clientSecretExpiresAt) {
        this.clientSecretExpiresAt = clientSecretExpiresAt;
    }

    public String getClientName() {
        return clientName;
    }

    public void setClientName(String clientName) {
        this.clientName = clientName;
    }

    public String getClientAuthenticationMethods() {
        return clientAuthenticationMethods;
    }

    public void setClientAuthenticationMethods(String clientAuthenticationMethods) {
        this.clientAuthenticationMethods = clientAuthenticationMethods;
    }

    public String getAuthorizationGrantTypes() {
        return authorizationGrantTypes;
    }

    public void setAuthorizationGrantTypes(String authorizationGrantTypes) {
        this.authorizationGrantTypes = authorizationGrantTypes;
    }

    public String getRedirectUris() {
        return redirectUris;
    }

    public void setRedirectUris(String redirectUris) {
        this.redirectUris = redirectUris;
    }

    public String getPostLogoutRedirectUris() {
        return postLogoutRedirectUris;
    }

    public void setPostLogoutRedirectUris(String postLogoutRedirectUris) {
        this.postLogoutRedirectUris = postLogoutRedirectUris;
    }

    public String getScopes() {
        return scopes;
    }

    public void setScopes(String scopes) {
        this.scopes = scopes;
    }

    public boolean isRequireAuthorizationConsent() {
        return requireAuthorizationConsent;
    }

    public void setRequireAuthorizationConsent(boolean requireAuthorizationConsent) {
        this.requireAuthorizationConsent = requireAuthorizationConsent;
    }

    public boolean isRequireProofKeyForCodeExchange() {
        return requireProofKeyForCodeExchange;
    }

    public void setRequireProofKeyForCodeExchange(boolean requireProofKeyForCodeExchange) {
        this.requireProofKeyForCodeExchange = requireProofKeyForCodeExchange;
    }

    public long getAccessTokenTimeToLiveSeconds() {
        return accessTokenTimeToLiveSeconds;
    }

    public void setAccessTokenTimeToLiveSeconds(long accessTokenTimeToLiveSeconds) {
        this.accessTokenTimeToLiveSeconds = accessTokenTimeToLiveSeconds;
    }

    public long getRefreshTokenTimeToLiveSeconds() {
        return refreshTokenTimeToLiveSeconds;
    }

    public void setRefreshTokenTimeToLiveSeconds(long refreshTokenTimeToLiveSeconds) {
        this.refreshTokenTimeToLiveSeconds = refreshTokenTimeToLiveSeconds;
    }

    public boolean isReuseRefreshTokens() {
        return reuseRefreshTokens;
    }

    public void setReuseRefreshTokens(boolean reuseRefreshTokens) {
        this.reuseRefreshTokens = reuseRefreshTokens;
    }
}
