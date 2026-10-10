package com.iam.dto;

import java.util.Map;

public class AdminDashboardStatsDto {
    private long totalUsers;
    private long activeUsers;
    private long disabledUsers;
    private long lockedUsers;
    private long mfaEnabledUsers;
    private long activeSessions;
    private long failedLogins24h;
    private long recentSecurityEventsCount;
    private Map<String, Long> roleDistribution;

    public AdminDashboardStatsDto() {
    }

    public long getTotalUsers() {
        return totalUsers;
    }

    public void setTotalUsers(long totalUsers) {
        this.totalUsers = totalUsers;
    }

    public long getActiveUsers() {
        return activeUsers;
    }

    public void setActiveUsers(long activeUsers) {
        this.activeUsers = activeUsers;
    }

    public long getDisabledUsers() {
        return disabledUsers;
    }

    public void setDisabledUsers(long disabledUsers) {
        this.disabledUsers = disabledUsers;
    }

    public long getLockedUsers() {
        return lockedUsers;
    }

    public void setLockedUsers(long lockedUsers) {
        this.lockedUsers = lockedUsers;
    }

    public long getMfaEnabledUsers() {
        return mfaEnabledUsers;
    }

    public void setMfaEnabledUsers(long mfaEnabledUsers) {
        this.mfaEnabledUsers = mfaEnabledUsers;
    }

    public long getActiveSessions() {
        return activeSessions;
    }

    public void setActiveSessions(long activeSessions) {
        this.activeSessions = activeSessions;
    }

    public long getFailedLogins24h() {
        return failedLogins24h;
    }

    public void setFailedLogins24h(long failedLogins24h) {
        this.failedLogins24h = failedLogins24h;
    }

    public long getRecentSecurityEventsCount() {
        return recentSecurityEventsCount;
    }

    public void setRecentSecurityEventsCount(long recentSecurityEventsCount) {
        this.recentSecurityEventsCount = recentSecurityEventsCount;
    }

    public Map<String, Long> getRoleDistribution() {
        return roleDistribution;
    }

    public void setRoleDistribution(Map<String, Long> roleDistribution) {
        this.roleDistribution = roleDistribution;
    }
}
