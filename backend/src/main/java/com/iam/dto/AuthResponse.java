package com.iam.dto;

public class AuthResponse {
    private boolean success;
    private String message;
    private UserDto user;
    private String sessionId;
    private boolean mfaRequired = false;
    private String mfaChallengeToken;

    public AuthResponse() {
    }

    public static AuthResponse mfaChallenge(String challengeToken) {
        AuthResponse response = new AuthResponse();
        response.setSuccess(true);
        response.setMfaRequired(true);
        response.setMfaChallengeToken(challengeToken);
        response.setMessage("Multi-factor authentication required. Please enter your 6-digit authenticator code.");
        return response;
    }

    public AuthResponse(boolean success, String message, UserDto user) {
        this.success = success;
        this.message = message;
        this.user = user;
    }

    public AuthResponse(boolean success, String message, UserDto user, String sessionId) {
        this.success = success;
        this.message = message;
        this.user = user;
        this.sessionId = sessionId;
    }

    public boolean isMfaRequired() {
        return mfaRequired;
    }

    public void setMfaRequired(boolean mfaRequired) {
        this.mfaRequired = mfaRequired;
    }

    public String getMfaChallengeToken() {
        return mfaChallengeToken;
    }

    public void setMfaChallengeToken(String mfaChallengeToken) {
        this.mfaChallengeToken = mfaChallengeToken;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public UserDto getUser() {
        return user;
    }

    public void setUser(UserDto user) {
        this.user = user;
    }
}
