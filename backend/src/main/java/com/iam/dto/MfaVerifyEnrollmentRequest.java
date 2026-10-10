package com.iam.dto;

import jakarta.validation.constraints.NotBlank;

public class MfaVerifyEnrollmentRequest {

    @NotBlank(message = "Verification code is required")
    private String code;

    public MfaVerifyEnrollmentRequest() {
    }

    public MfaVerifyEnrollmentRequest(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }
}
