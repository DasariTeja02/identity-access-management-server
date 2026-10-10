package com.iam.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "user_mfa_settings", indexes = {
    @Index(name = "idx_user_mfa_user_id", columnList = "user_id", unique = true)
})
public class UserMfaSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "mfa_enabled", nullable = false)
    private boolean mfaEnabled = false;

    @Column(name = "encrypted_secret", length = 500)
    private String encryptedSecret;

    @Column(name = "enrolled_at")
    private Instant enrolledAt;

    @Column(name = "last_verified_at")
    private Instant lastVerifiedAt;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts = 0;

    @Column(name = "lockout_until")
    private Instant lockoutUntil;

    public UserMfaSettings() {
    }

    public UserMfaSettings(User user) {
        this.user = user;
        this.mfaEnabled = false;
        this.failedAttempts = 0;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public boolean isMfaEnabled() {
        return mfaEnabled;
    }

    public void setMfaEnabled(boolean mfaEnabled) {
        this.mfaEnabled = mfaEnabled;
    }

    public String getEncryptedSecret() {
        return encryptedSecret;
    }

    public void setEncryptedSecret(String encryptedSecret) {
        this.encryptedSecret = encryptedSecret;
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

    public int getFailedAttempts() {
        return failedAttempts;
    }

    public void setFailedAttempts(int failedAttempts) {
        this.failedAttempts = failedAttempts;
    }

    public Instant getLockoutUntil() {
        return lockoutUntil;
    }

    public void setLockoutUntil(Instant lockoutUntil) {
        this.lockoutUntil = lockoutUntil;
    }
}
