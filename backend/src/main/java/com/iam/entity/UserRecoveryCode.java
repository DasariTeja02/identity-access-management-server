package com.iam.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "user_recovery_codes", indexes = {
    @Index(name = "idx_user_recovery_user_id", columnList = "user_id"),
    @Index(name = "idx_user_recovery_code_hash", columnList = "code_hash")
})
public class UserRecoveryCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "code_hash", nullable = false, length = 120)
    private String codeHash;

    @Column(name = "used", nullable = false)
    private boolean used = false;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UserRecoveryCode() {
    }

    public UserRecoveryCode(User user, String codeHash) {
        this.user = user;
        this.codeHash = codeHash;
        this.used = false;
        this.createdAt = Instant.now();
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

    public String getCodeHash() {
        return codeHash;
    }

    public void setCodeHash(String codeHash) {
        this.codeHash = codeHash;
    }

    public boolean isUsed() {
        return used;
    }

    public void setUsed(boolean used) {
        this.used = used;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public void setUsedAt(Instant usedAt) {
        this.usedAt = usedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
