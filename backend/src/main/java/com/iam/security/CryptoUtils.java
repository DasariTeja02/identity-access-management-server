package com.iam.security;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * Enterprise cryptographic utility for MFA:
 * 1. AES-GCM-256 authenticated encryption at rest for TOTP shared secrets.
 * 2. SHA-256 cryptographic one-way hashing for one-time recovery codes.
 * 3. Cryptographically secure random generator for recovery codes.
 */
@Component
public class CryptoUtils {

    private static final Logger log = LoggerFactory.getLogger(CryptoUtils.class);

    private static final String ENCRYPTION_ALGO = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12; // 96-bit IV recommended for GCM
    private static final int GCM_TAG_LENGTH = 128; // 128-bit authentication tag
    private static final String RECOVERY_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final SecretKey secretKey;
    private final SecureRandom secureRandom;

    public CryptoUtils(@Value("${iam.mfa.encryption-key:IamEnterpriseSecretKey2026Mfa!}") String rawKey) {
        this.secureRandom = new SecureRandom();
        byte[] keyBytes = deriveKeyBytes(rawKey);
        this.secretKey = new SecretKeySpec(keyBytes, "AES");
    }

    /**
     * Encrypts plaintext (e.g., TOTP Base32 secret) using AES-256-GCM.
     * Returns Base64-encoded [IV (12 bytes) + Ciphertext + Tag (16 bytes)].
     */
    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isEmpty()) {
            return null;
        }
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(ENCRYPTION_ALGO);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, parameterSpec);

            byte[] cipherText = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            ByteBuffer byteBuffer = ByteBuffer.allocate(iv.length + cipherText.length);
            byteBuffer.put(iv);
            byteBuffer.put(cipherText);

            return Base64.getEncoder().encodeToString(byteBuffer.array());
        } catch (Exception e) {
            log.error("Error encrypting TOTP secret: {}", e.getMessage());
            throw new IllegalStateException("Cryptographic encryption failure", e);
        }
    }

    /**
     * Decrypts ciphertext using AES-256-GCM.
     */
    public String decrypt(String encryptedBase64) {
        if (encryptedBase64 == null || encryptedBase64.isEmpty()) {
            return null;
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(encryptedBase64);
            ByteBuffer byteBuffer = ByteBuffer.wrap(decoded);

            byte[] iv = new byte[GCM_IV_LENGTH];
            byteBuffer.get(iv);

            byte[] cipherText = new byte[byteBuffer.remaining()];
            byteBuffer.get(cipherText);

            Cipher cipher = Cipher.getInstance(ENCRYPTION_ALGO);
            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH, iv);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, parameterSpec);

            byte[] plainBytes = cipher.doFinal(cipherText);
            return new String(plainBytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Error decrypting TOTP secret: {}", e.getMessage());
            throw new IllegalStateException("Cryptographic decryption failure", e);
        }
    }

    /**
     * Hashes one-time recovery code using SHA-256.
     */
    public String hashRecoveryCode(String rawCode) {
        if (rawCode == null) {
            return null;
        }
        String normalized = rawCode.trim().toUpperCase().replace("-", "");
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(normalized.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    /**
     * Generates a batch of human-friendly, cryptographically secure recovery codes.
     * Format: XXXXX-XXXXX (10 characters separated by a hyphen)
     */
    public List<String> generateRecoveryCodes(int count) {
        List<String> codes = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            StringBuilder sb = new StringBuilder();
            for (int j = 0; j < 10; j++) {
                if (j == 5) {
                    sb.append('-');
                }
                int idx = secureRandom.nextInt(RECOVERY_CODE_CHARS.length());
                sb.append(RECOVERY_CODE_CHARS.charAt(idx));
            }
            codes.add(sb.toString());
        }
        return codes;
    }

    private byte[] deriveKeyBytes(String rawKey) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return sha.digest(rawKey.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available for key derivation", e);
        }
    }
}
