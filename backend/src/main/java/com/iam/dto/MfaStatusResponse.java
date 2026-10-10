package com.iam.dto;

import java.time.Instant;

public class MfaStatusResponse {
    private boolean enabled;
    private Instant enrolledAt;
    private Instant lastVerifiedAt;
    private long recoveryCodesRemaining;

    public MfaStatusResponse() {
    }

    public MfaStatusResponse(boolean enabled, Instant enrolledAt, long recoveryCodesRemaining) {
        this.enabled = enabled;
        this.enrolledAt = enrolledAt;
        this.recoveryCodesRemaining = recoveryCodesRemaining;
    }

    public MfaStatusResponse(boolean enabled, Instant enrolledAt, Instant lastVerifiedAt, long recoveryCodesRemaining) {
        this.enabled = enabled;
        this.enrolledAt = enrolledAt;
        this.lastVerifiedAt = lastVerifiedAt;
        this.recoveryCodesRemaining = recoveryCodesRemaining;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Instant getEnrolledAt() {
        return enrolledAt;
    }

    public void setEnrolledAt(Instant enrolledAt) {
        this.enrolledAt = enrolledAt;
    }

    public Instant getLastVerifiedAt() {
        return lastVerifiedAt;
    }

    public void setLastVerifiedAt(Instant lastVerifiedAt) {
        this.lastVerifiedAt = lastVerifiedAt;
    }

    public long getRecoveryCodesRemaining() {
        return recoveryCodesRemaining;
    }

    public void setRecoveryCodesRemaining(long recoveryCodesRemaining) {
        this.recoveryCodesRemaining = recoveryCodesRemaining;
    }
}
