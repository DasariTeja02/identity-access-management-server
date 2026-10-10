package com.iam.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.warrenstrange.googleauth.GoogleAuthenticator;
import com.warrenstrange.googleauth.GoogleAuthenticatorConfig;
import com.warrenstrange.googleauth.GoogleAuthenticatorKey;
import com.warrenstrange.googleauth.HmacHashFunction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.TimeUnit;

/**
 * Standard RFC 6238 TOTP engine integrated with Google Authenticator specification:
 * - 30-second time step
 * - 6-digit verification code
 * - HMAC-SHA1 algorithm
 * - Clock skew tolerance: +/- 1 time step (windowSize = 1)
 * - Base32 secret generation
 * - ZXing QR code image generation in data URI format
 */
@Service
public class TotpService {

    private static final Logger log = LoggerFactory.getLogger(TotpService.class);

    @Value("${iam.mfa.issuer:IAM Server}")
    private String issuer;

    @Value("${iam.mfa.window-size:1}")
    private int windowSize;

    private final GoogleAuthenticator googleAuthenticator;

    public TotpService(@Value("${iam.mfa.window-size:1}") int windowSize) {
        this.windowSize = windowSize;
        GoogleAuthenticatorConfig config = new GoogleAuthenticatorConfig.GoogleAuthenticatorConfigBuilder()
                .setTimeStepSizeInMillis(TimeUnit.SECONDS.toMillis(30))
                .setWindowSize(windowSize) // +/- 1 step tolerance for clock skew
                .setCodeDigits(6)
                .setHmacHashFunction(HmacHashFunction.HmacSHA1)
                .build();
        this.googleAuthenticator = new GoogleAuthenticator(config);
    }

    /**
     * Generates a new cryptographically secure Base32 TOTP secret.
     */
    public String generateSecret() {
        GoogleAuthenticatorKey key = googleAuthenticator.createCredentials();
        return key.getKey();
    }

    public String generateSecretKey() {
        return generateSecret();
    }

    /**
     * Constructs standard RFC otpauth URI:
     * otpauth://totp/{issuer}:{username}?secret={secret}&issuer={issuer}
     */
    public String buildOtpAuthUri(String username, String secret) {
        String encodedIssuer = URLEncoder.encode(issuer, StandardCharsets.UTF_8).replace("+", "%20");
        String encodedUser = URLEncoder.encode(username, StandardCharsets.UTF_8).replace("+", "%20");
        return String.format("otpauth://totp/%s:%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30",
                encodedIssuer, encodedUser, secret, encodedIssuer);
    }

    public String getOtpAuthUri(String secret, String username) {
        return buildOtpAuthUri(username, secret);
    }

    /**
     * Generates a 240x240 PNG QR Code as a Base64 data URI string:
     * data:image/png;base64,...
     */
    public String generateQrCodeDataUri(String otpAuthUri) {
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(otpAuthUri, BarcodeFormat.QR_CODE, 240, 240);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", baos);
            byte[] imageBytes = baos.toByteArray();
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(imageBytes);
        } catch (Exception e) {
            log.error("Error rendering QR code: {}", e.getMessage());
            throw new IllegalStateException("Failed to generate QR code", e);
        }
    }

    public String generateQrCodeDataUri(String otpAuthUri, int width, int height) {
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(otpAuthUri, BarcodeFormat.QR_CODE, width, height);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", baos);
            byte[] imageBytes = baos.toByteArray();
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(imageBytes);
        } catch (Exception e) {
            log.error("Error rendering QR code: {}", e.getMessage());
            throw new IllegalStateException("Failed to generate QR code", e);
        }
    }

    /**
     * Verifies the user-supplied 6-digit code against the shared secret.
     */
    public boolean verifyCode(String secret, int code) {
        if (secret == null || secret.isBlank()) {
            return false;
        }
        return googleAuthenticator.authorize(secret, code);
    }

    public boolean verifyCode(String secret, String codeStr) {
        if (secret == null || codeStr == null || codeStr.isBlank()) {
            return false;
        }
        try {
            int code = Integer.parseInt(codeStr.trim());
            return verifyCode(secret, code);
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /**
     * Computes the current TOTP password for a secret (used for automated testing and verification).
     */
    public int getCurrentCode(String secret) {
        return googleAuthenticator.getTotpPassword(secret);
    }
}
