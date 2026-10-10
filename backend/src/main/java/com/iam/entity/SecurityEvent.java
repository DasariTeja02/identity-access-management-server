package com.iam.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "security_events", indexes = {
    @Index(name = "idx_security_events_user_id", columnList = "user_id"),
    @Index(name = "idx_security_events_type", columnList = "event_type"),
    @Index(name = "idx_security_events_timestamp", columnList = "timestamp")
})
public class SecurityEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false, length = 60)
    private String eventType;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "username", length = 100)
    private String username;

    @Column(name = "session_id", length = 120)
    private String sessionId;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;

    @Column(name = "details", length = 1000)
    private String details;

    @Column(name = "timestamp", nullable = false)
    private Instant timestamp;

    public SecurityEvent() {
    }

    public SecurityEvent(String eventType, Long userId, String username, String sessionId, String ipAddress, String details) {
        this.eventType = eventType;
        this.userId = userId;
        this.username = username;
        this.sessionId = sessionId;
        this.ipAddress = ipAddress;
        this.details = details;
        this.timestamp = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEventType() {
        return eventType;
    }

    public void setEventType(String eventType) {
        this.eventType = eventType;
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

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }
}
