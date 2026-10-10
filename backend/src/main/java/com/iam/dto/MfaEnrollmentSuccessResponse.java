package com.iam.dto;

import java.util.List;

public class MfaEnrollmentSuccessResponse {
    private boolean enabled;
    private String message;
    private List<String> recoveryCodes;

    public MfaEnrollmentSuccessResponse() {
    }

    public MfaEnrollmentSuccessResponse(boolean enabled, List<String> recoveryCodes) {
        this.enabled = enabled;
        this.recoveryCodes = recoveryCodes;
    }

    public MfaEnrollmentSuccessResponse(boolean enabled, String message, List<String> recoveryCodes) {
        this.enabled = enabled;
        this.message = message;
        this.recoveryCodes = recoveryCodes;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public List<String> getRecoveryCodes() {
        return recoveryCodes;
    }

    public void setRecoveryCodes(List<String> recoveryCodes) {
        this.recoveryCodes = recoveryCodes;
    }
}
