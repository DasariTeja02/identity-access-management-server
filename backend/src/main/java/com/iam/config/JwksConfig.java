package com.iam.config;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.UUID;

/**
 * Hardened JWKS Configuration for OAuth 2.0 / OIDC JWT token signing and validation.
 * Supports persistent external RSA keys via environment variables/properties,
 * preventing unexpected key rotation across application restarts in production,
 * with graceful fallback to secure 2048-bit ephemeral RSA keys for dev/testing.
 */
@Configuration
public class JwksConfig {

    private static final Logger log = LoggerFactory.getLogger(JwksConfig.class);

    private final RSAKey rsaKey;

    public JwksConfig(
            @Value("${iam.jwt.rsa.private-key:}") String privateKeyPem,
            @Value("${iam.jwt.rsa.public-key:}") String publicKeyPem,
            @Value("${iam.jwt.rsa.key-id:iam-jwt-key-2026}") String keyId) {

        RSAKey loadedKey = null;
        if (privateKeyPem != null && !privateKeyPem.trim().isEmpty() &&
            publicKeyPem != null && !publicKeyPem.trim().isEmpty()) {
            try {
                loadedKey = loadConfiguredRsaKey(privateKeyPem, publicKeyPem, keyId);
                log.info("Successfully loaded external RSA signing key with keyId: {}", keyId);
            } catch (Exception ex) {
                log.warn("Failed to parse external RSA keys, falling back to ephemeral key pair: {}", ex.getMessage());
            }
        }

        if (loadedKey != null) {
            this.rsaKey = loadedKey;
        } else {
            log.info("No external RSA keys configured; generating secure ephemeral 2048-bit RSA KeyPair for runtime...");
            this.rsaKey = generateRsaKey(keyId);
        }
    }

    @Bean
    public JWKSource<SecurityContext> jwkSource() {
        JWKSet jwkSet = new JWKSet(this.rsaKey);
        return new ImmutableJWKSet<>(jwkSet);
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        try {
            return NimbusJwtDecoder.withPublicKey(this.rsaKey.toRSAPublicKey()).build();
        } catch (Exception ex) {
            log.error("Failed to construct JwtDecoder with RSA public key", ex);
            throw new IllegalStateException("Could not create JwtDecoder", ex);
        }
    }

    private static RSAKey loadConfiguredRsaKey(String privateKeyPem, String publicKeyPem, String keyId) throws Exception {
        KeyFactory keyFactory = KeyFactory.getInstance("RSA");

        String cleanedPub = publicKeyPem
                .replace("-----BEGIN PUBLIC KEY-----", "")
                .replace("-----END PUBLIC KEY-----", "")
                .replaceAll("\\s+", "");
        byte[] pubBytes = Base64.getDecoder().decode(cleanedPub);
        RSAPublicKey publicKey = (RSAPublicKey) keyFactory.generatePublic(new X509EncodedKeySpec(pubBytes));

        String cleanedPriv = privateKeyPem
                .replace("-----BEGIN PRIVATE KEY-----", "")
                .replace("-----END PRIVATE KEY-----", "")
                .replaceAll("\\s+", "");
        byte[] privBytes = Base64.getDecoder().decode(cleanedPriv);
        RSAPrivateKey privateKey = (RSAPrivateKey) keyFactory.generatePrivate(new PKCS8EncodedKeySpec(privBytes));

        return new RSAKey.Builder(publicKey)
                .privateKey(privateKey)
                .keyUse(com.nimbusds.jose.jwk.KeyUse.SIGNATURE)
                .keyID(keyId != null && !keyId.trim().isEmpty() ? keyId : "iam-jwt-key-2026")
                .build();
    }

    private static RSAKey generateRsaKey(String keyId) {
        KeyPair keyPair = generateKeyPair();
        RSAPublicKey publicKey = (RSAPublicKey) keyPair.getPublic();
        RSAPrivateKey privateKey = (RSAPrivateKey) keyPair.getPrivate();

        return new RSAKey.Builder(publicKey)
                .privateKey(privateKey)
                .keyUse(com.nimbusds.jose.jwk.KeyUse.SIGNATURE)
                .keyID(keyId != null && !keyId.trim().isEmpty() ? keyId : UUID.randomUUID().toString())
                .build();
    }

    private static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
            keyPairGenerator.initialize(2048);
            return keyPairGenerator.generateKeyPair();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("RSA algorithm unavailable", ex);
        }
    }
}
