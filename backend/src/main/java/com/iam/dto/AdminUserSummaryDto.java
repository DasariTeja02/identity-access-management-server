package com.iam.dto;

import java.time.Instant;
import java.util.Set;

public class AdminUserSummaryDto {
    private Long id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private boolean enabled;
    private boolean accountNonLocked;
    private Set<String> roles;
    private boolean mfaEnabled;
    private Instant createdAt;
    private Instant lastLoginAt;
    private long activeSessionsCount;

    public AdminUserSummaryDto() {
    }

    public AdminUserSummaryDto(Long id, String username, String email, String firstName, String lastName,
                               boolean enabled, boolean accountNonLocked, Set<String> roles, boolean mfaEnabled,
                               Instant createdAt, Instant lastLoginAt, long activeSessionsCount) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.enabled = enabled;
        this.accountNonLocked = accountNonLocked;
        this.roles = roles;
        this.mfaEnabled = mfaEnabled;
        this.createdAt = createdAt;
        this.lastLoginAt = lastLoginAt;
        this.activeSessionsCount = activeSessionsCount;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isAccountNonLocked() {
        return accountNonLocked;
    }

    public void setAccountNonLocked(boolean accountNonLocked) {
        this.accountNonLocked = accountNonLocked;
    }

    public Set<String> getRoles() {
        return roles;
    }

    public void setRoles(Set<String> roles) {
        this.roles = roles;
    }

    public boolean isMfaEnabled() {
        return mfaEnabled;
    }

    public void setMfaEnabled(boolean mfaEnabled) {
        this.mfaEnabled = mfaEnabled;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(Instant lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }

    public long getActiveSessionsCount() {
        return activeSessionsCount;
    }

    public void setActiveSessionsCount(long activeSessionsCount) {
        this.activeSessionsCount = activeSessionsCount;
    }
}
