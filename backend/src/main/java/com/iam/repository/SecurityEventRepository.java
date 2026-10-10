package com.iam.repository;

import com.iam.entity.SecurityEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface SecurityEventRepository extends JpaRepository<SecurityEvent, Long>, JpaSpecificationExecutor<SecurityEvent> {

    List<SecurityEvent> findAllByOrderByTimestampDesc();

    List<SecurityEvent> findByUserIdOrderByTimestampDesc(Long userId);

    List<SecurityEvent> findByUsernameOrderByTimestampDesc(String username);

    List<SecurityEvent> findByEventTypeOrderByTimestampDesc(String eventType);

    @Query("SELECT COUNT(e) FROM SecurityEvent e WHERE (e.eventType = 'LOGIN_FAILED' OR e.eventType = 'LOGIN_FAILURE' OR e.eventType = 'MFA_VERIFICATION_FAILED') AND e.timestamp >= :since")
    long countFailedLoginsSince(@Param("since") Instant since);

    @Query("SELECT COUNT(e) FROM SecurityEvent e WHERE e.timestamp >= :since")
    long countEventsSince(@Param("since") Instant since);
}
