package com.iam.repository;

import com.iam.entity.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserSessionRepository extends JpaRepository<UserSession, Long> {

    Optional<UserSession> findBySessionId(String sessionId);

    List<UserSession> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<UserSession> findByUserIdAndRevokedFalseOrderByCreatedAtDesc(Long userId);

    List<UserSession> findAllByOrderByCreatedAtDesc();

    List<UserSession> findByUser_UsernameOrderByCreatedAtDesc(String username);

    @Modifying
    @Query("UPDATE UserSession s SET s.revoked = true, s.revokedAt = :revokedAt, s.revokedBy = :revokedBy WHERE s.user.id = :userId AND s.revoked = false")
    int revokeAllByUserId(@Param("userId") Long userId, @Param("revokedAt") Instant revokedAt, @Param("revokedBy") String revokedBy);

    @Modifying
    @Query("UPDATE UserSession s SET s.lastActiveAt = :lastActiveAt WHERE s.sessionId = :sessionId")
    int updateLastActiveAt(@Param("sessionId") String sessionId, @Param("lastActiveAt") Instant lastActiveAt);

    long countByRevokedFalse();

    long countByUserIdAndRevokedFalse(Long userId);
}
