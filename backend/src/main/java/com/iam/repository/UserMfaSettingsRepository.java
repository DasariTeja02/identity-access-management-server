package com.iam.repository;

import com.iam.entity.UserMfaSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserMfaSettingsRepository extends JpaRepository<UserMfaSettings, Long> {

    Optional<UserMfaSettings> findByUserId(Long userId);

    Optional<UserMfaSettings> findByUser_Username(String username);

    boolean existsByUserIdAndMfaEnabledTrue(Long userId);

    long countByMfaEnabledTrue();
}
