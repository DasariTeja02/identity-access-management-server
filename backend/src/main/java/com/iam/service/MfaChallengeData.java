package com.iam.service;

import java.io.Serializable;
import java.time.Instant;

public class MfaChallengeData implements Serializable {

    private static final long serialVersionUID = 1L;

    private String challengeToken;
    private Long userId;
    private String username;
    private int attempts;
    private Instant createdAt;
    private Instant expiresAt;

    public MfaChallengeData() {
    }

    public MfaChallengeData(String challengeToken, Long userId, String username) {
        this.challengeToken = challengeToken;
        this.userId = userId;
        this.username = username;
        this.attempts = 0;
        this.createdAt = Instant.now();
    }

    public MfaChallengeData(String challengeToken, Long userId, String username, Instant expiresAt) {
        this.challengeToken = challengeToken;
        this.userId = userId;
        this.username = username;
        this.attempts = 0;
        this.createdAt = Instant.now();
        this.expiresAt = expiresAt;
    }

    public String getChallengeToken() {
        return challengeToken;
    }

    public void setChallengeToken(String challengeToken) {
        this.challengeToken = challengeToken;
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

    public int getAttempts() {
        return attempts;
    }

    public void setAttempts(int attempts) {
        this.attempts = attempts;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }
}
