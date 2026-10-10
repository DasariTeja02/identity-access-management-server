package com.iam.dto;

public class LockUserRequest {
    private String reason;

    public LockUserRequest() {
    }

    public LockUserRequest(String reason) {
        this.reason = reason;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
