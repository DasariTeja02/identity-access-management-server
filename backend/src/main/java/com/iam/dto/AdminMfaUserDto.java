package com.iam.dto;

import java.time.Instant;

public class AdminMfaUserDto {
    private Long userId;
    private String username;
    private String email;
    private boolean mfaEnabled;
    private Instant enrolledAt;
    private long recoveryCodesRemaining;

    public AdminMfaUserDto() {
    }

    public AdminMfaUserDto(Long userId, String username, String email, boolean mfaEnabled, Instant enrolledAt, long recoveryCodesRemaining) {
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.mfaEnabled = mfaEnabled;
        this.enrolledAt = enrolledAt;
        this.recoveryCodesRemaining = recoveryCodesRemaining;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public boolean isMfaEnabled() {
        return mfaEnabled;
    }

    public void setMfaEnabled(boolean mfaEnabled) {
        this.mfaEnabled = mfaEnabled;
    }

    public Instant getEnrolledAt() {
        return enrolledAt;
    }

    public void setEnrolledAt(Instant enrolledAt) {
        this.enrolledAt = enrolledAt;
    }

    public long getRecoveryCodesRemaining() {
        return recoveryCodesRemaining;
    }

    public void setRecoveryCodesRemaining(long recoveryCodesRemaining) {
        this.recoveryCodesRemaining = recoveryCodesRemaining;
    }
}
