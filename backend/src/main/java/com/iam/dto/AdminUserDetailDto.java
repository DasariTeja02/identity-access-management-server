package com.iam.dto;

import java.time.Instant;
import java.util.List;
import java.util.Set;

public class AdminUserDetailDto {
    private Long id;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private boolean enabled;
    private boolean accountNonLocked;
    private boolean accountNonExpired;
    private boolean credentialsNonExpired;
    private Set<String> roles;
    private Set<String> authorities;
    private boolean mfaEnabled;
    private Instant mfaEnrolledAt;
    private long recoveryCodesRemaining;
    private Instant createdAt;
    private Instant updatedAt;
    private List<SessionDto> activeSessions;
    private List<SecurityEventDto> recentSecurityEvents;

    public AdminUserDetailDto() {
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

    public boolean isAccountNonExpired() {
        return accountNonExpired;
    }

    public void setAccountNonExpired(boolean accountNonExpired) {
        this.accountNonExpired = accountNonExpired;
    }

    public boolean isCredentialsNonExpired() {
        return credentialsNonExpired;
    }

    public void setCredentialsNonExpired(boolean credentialsNonExpired) {
        this.credentialsNonExpired = credentialsNonExpired;
    }

    public Set<String> getRoles() {
        return roles;
    }

    public void setRoles(Set<String> roles) {
        this.roles = roles;
    }

    public Set<String> getAuthorities() {
        return authorities;
    }

    public void setAuthorities(Set<String> authorities) {
        this.authorities = authorities;
    }

    public boolean isMfaEnabled() {
        return mfaEnabled;
    }

    public void setMfaEnabled(boolean mfaEnabled) {
        this.mfaEnabled = mfaEnabled;
    }

    public Instant getMfaEnrolledAt() {
        return mfaEnrolledAt;
    }

    public void setMfaEnrolledAt(Instant mfaEnrolledAt) {
        this.mfaEnrolledAt = mfaEnrolledAt;
    }

    public long getRecoveryCodesRemaining() {
        return recoveryCodesRemaining;
    }

    public void setRecoveryCodesRemaining(long recoveryCodesRemaining) {
        this.recoveryCodesRemaining = recoveryCodesRemaining;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<SessionDto> getActiveSessions() {
        return activeSessions;
    }

    public void setActiveSessions(List<SessionDto> activeSessions) {
        this.activeSessions = activeSessions;
    }

    public List<SecurityEventDto> getRecentSecurityEvents() {
        return recentSecurityEvents;
    }

    public void setRecentSecurityEvents(List<SecurityEventDto> recentSecurityEvents) {
        this.recentSecurityEvents = recentSecurityEvents;
    }
}
