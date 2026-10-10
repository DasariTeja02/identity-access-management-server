package com.iam.dto;

import java.util.List;

public class MfaEnrollmentResponse {
    private String secret;
    private String otpAuthUri;
    private String qrCodeDataUri;

    public MfaEnrollmentResponse() {
    }

    public MfaEnrollmentResponse(String secret, String otpAuthUri, String qrCodeDataUri) {
        this.secret = secret;
        this.otpAuthUri = otpAuthUri;
        this.qrCodeDataUri = qrCodeDataUri;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public String getOtpAuthUri() {
        return otpAuthUri;
    }

    public void setOtpAuthUri(String otpAuthUri) {
        this.otpAuthUri = otpAuthUri;
    }

    public String getQrCodeDataUri() {
        return qrCodeDataUri;
    }

    public void setQrCodeDataUri(String qrCodeDataUri) {
        this.qrCodeDataUri = qrCodeDataUri;
    }
}
