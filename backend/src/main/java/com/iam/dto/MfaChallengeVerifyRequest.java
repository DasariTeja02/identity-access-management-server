package com.iam.dto;

import jakarta.validation.constraints.NotBlank;

public class MfaChallengeVerifyRequest {

    @NotBlank(message = "Challenge token is required")
    private String challengeToken;

    // Either code (TOTP) or recoveryCode must be provided
    private String code;
    private String recoveryCode;

    public MfaChallengeVerifyRequest() {
    }

    public MfaChallengeVerifyRequest(String challengeToken, String code, String recoveryCode) {
        this.challengeToken = challengeToken;
        this.code = code;
        this.recoveryCode = recoveryCode;
    }

    public String getChallengeToken() {
        return challengeToken;
    }

    public void setChallengeToken(String challengeToken) {
        this.challengeToken = challengeToken;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getRecoveryCode() {
        return recoveryCode;
    }

    public void setRecoveryCode(String recoveryCode) {
        this.recoveryCode = recoveryCode;
    }
}
