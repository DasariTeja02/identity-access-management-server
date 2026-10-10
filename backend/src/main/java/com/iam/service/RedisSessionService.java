package com.iam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iam.exception.RedisUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * Service managing high-performance temporary session and token revocation state in Redis.
 * Key Schema:
 *   iam:session:{sessionId}           -> JSON representation of RedisSessionData (TTL = remaining session life)
 *   iam:user:sessions:{userId}        -> Set of sessionIds for fast lookup
 *   iam:revoked:session:{sessionId}   -> Revocation marker with TTL
 *   iam:revoked:token:{tokenIdentifier} -> Revocation marker with TTL
 */
@Service
public class RedisSessionService {

    private static final Logger log = LoggerFactory.getLogger(RedisSessionService.class);

    private static final String PREFIX_SESSION = "iam:session:";
    private static final String PREFIX_USER_SESSIONS = "iam:user:sessions:";
    private static final String PREFIX_REVOKED_SESSION = "iam:revoked:session:";
    private static final String PREFIX_REVOKED_TOKEN = "iam:revoked:token:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${iam.redis.required:true}")
    private boolean redisRequired;

    public RedisSessionService(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public boolean isRedisAvailable() {
        try {
            String ping = redisTemplate.getConnectionFactory().getConnection().ping();
            return "PONG".equalsIgnoreCase(ping);
        } catch (Exception e) {
            log.warn("Redis health check failed: {}", e.getMessage());
            return false;
        }
    }

    public void saveSession(RedisSessionData sessionData, Duration ttl) {
        try {
            String json = objectMapper.writeValueAsString(sessionData);
            String sessionKey = PREFIX_SESSION + sessionData.getSessionId();
            redisTemplate.opsForValue().set(sessionKey, json, ttl);

            if (sessionData.getUserId() != null) {
                String userKey = PREFIX_USER_SESSIONS + sessionData.getUserId();
                redisTemplate.opsForSet().add(userKey, sessionData.getSessionId());
                redisTemplate.expire(userKey, Duration.ofDays(7));
            }
            log.debug("Session saved to Redis: sessionId={}, ttl={}", sessionData.getSessionId(), ttl);
        } catch (Exception e) {
            handleRedisException("Error saving session to Redis", e);
        }
    }

    public Optional<RedisSessionData> getSession(String sessionId) {
        try {
            String sessionKey = PREFIX_SESSION + sessionId;
            String json = redisTemplate.opsForValue().get(sessionKey);
            if (json == null) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(json, RedisSessionData.class));
        } catch (Exception e) {
            handleRedisException("Error fetching session from Redis", e);
            return Optional.empty();
        }
    }

    public void touchSession(String sessionId, Duration ttl) {
        try {
            String sessionKey = PREFIX_SESSION + sessionId;
            String json = redisTemplate.opsForValue().get(sessionKey);
            if (json != null) {
                RedisSessionData data = objectMapper.readValue(json, RedisSessionData.class);
                data.setLastActiveAt(Instant.now());
                redisTemplate.opsForValue().set(sessionKey, objectMapper.writeValueAsString(data), ttl);
            }
        } catch (Exception e) {
            handleRedisException("Error touching session in Redis", e);
        }
    }

    public void deleteSession(String sessionId, Long userId) {
        try {
            String sessionKey = PREFIX_SESSION + sessionId;
            redisTemplate.delete(sessionKey);

            if (userId != null) {
                String userKey = PREFIX_USER_SESSIONS + userId;
                redisTemplate.opsForSet().remove(userKey, sessionId);
            }
            log.debug("Deleted session from Redis: sessionId={}", sessionId);
        } catch (Exception e) {
            handleRedisException("Error deleting session from Redis", e);
        }
    }

    public void deleteAllUserSessions(Long userId) {
        try {
            String userKey = PREFIX_USER_SESSIONS + userId;
            Set<String> sessionIds = redisTemplate.opsForSet().members(userKey);
            if (sessionIds != null && !sessionIds.isEmpty()) {
                List<String> keysToDelete = new ArrayList<>();
                for (String sid : sessionIds) {
                    keysToDelete.add(PREFIX_SESSION + sid);
                }
                redisTemplate.delete(keysToDelete);
            }
            redisTemplate.delete(userKey);
            log.debug("Deleted all sessions for userId={}", userId);
        } catch (Exception e) {
            handleRedisException("Error deleting all user sessions from Redis", e);
        }
    }

    public void revokeSession(String sessionId, Duration blacklistDuration) {
        try {
            String revokeKey = PREFIX_REVOKED_SESSION + sessionId;
            redisTemplate.opsForValue().set(revokeKey, "REVOKED", blacklistDuration);
            log.info("Blacklisted session in Redis: sessionId={}, duration={}", sessionId, blacklistDuration);
        } catch (Exception e) {
            handleRedisException("Error marking session as revoked in Redis", e);
        }
    }

    public boolean isSessionRevoked(String sessionId) {
        try {
            String revokeKey = PREFIX_REVOKED_SESSION + sessionId;
            Boolean hasKey = redisTemplate.hasKey(revokeKey);
            return Boolean.TRUE.equals(hasKey);
        } catch (Exception e) {
            handleRedisException("Error checking session revocation in Redis", e);
            return false;
        }
    }

    public void revokeToken(String tokenIdentifier, Duration blacklistDuration) {
        try {
            String revokeKey = PREFIX_REVOKED_TOKEN + tokenIdentifier;
            redisTemplate.opsForValue().set(revokeKey, "REVOKED", blacklistDuration);
            log.info("Blacklisted token in Redis: jti={}, duration={}", tokenIdentifier, blacklistDuration);
        } catch (Exception e) {
            handleRedisException("Error blacklisting token in Redis", e);
        }
    }

    public boolean isTokenRevoked(String tokenIdentifier) {
        try {
            String revokeKey = PREFIX_REVOKED_TOKEN + tokenIdentifier;
            Boolean hasKey = redisTemplate.hasKey(revokeKey);
            return Boolean.TRUE.equals(hasKey);
        } catch (Exception e) {
            handleRedisException("Error checking token revocation in Redis", e);
            return false;
        }
    }

    public void saveMfaChallenge(MfaChallengeData challengeData, Duration ttl) {
        try {
            String json = objectMapper.writeValueAsString(challengeData);
            String key = "iam:mfa:challenge:" + challengeData.getChallengeToken();
            redisTemplate.opsForValue().set(key, json, ttl);
            log.debug("MFA challenge saved to Redis: token={}, ttl={}", challengeData.getChallengeToken(), ttl);
        } catch (Exception e) {
            handleRedisException("Error saving MFA challenge to Redis", e);
        }
    }

    public Optional<MfaChallengeData> getMfaChallenge(String challengeToken) {
        try {
            String key = "iam:mfa:challenge:" + challengeToken;
            String json = redisTemplate.opsForValue().get(key);
            if (json == null) {
                return Optional.empty();
            }
            return Optional.of(objectMapper.readValue(json, MfaChallengeData.class));
        } catch (Exception e) {
            handleRedisException("Error fetching MFA challenge from Redis", e);
            return Optional.empty();
        }
    }

    public void deleteMfaChallenge(String challengeToken) {
        try {
            String key = "iam:mfa:challenge:" + challengeToken;
            redisTemplate.delete(key);
            log.debug("Deleted MFA challenge from Redis: token={}", challengeToken);
        } catch (Exception e) {
            handleRedisException("Error deleting MFA challenge from Redis", e);
        }
    }

    public void savePendingEnrollmentSecret(Long userId, String secret, Duration ttl) {
        try {
            String key = "iam:mfa:enrollment:" + userId;
            redisTemplate.opsForValue().set(key, secret, ttl);
        } catch (Exception e) {
            handleRedisException("Error saving pending enrollment secret to Redis", e);
        }
    }

    public Optional<String> getPendingEnrollmentSecret(Long userId) {
        try {
            String key = "iam:mfa:enrollment:" + userId;
            String secret = redisTemplate.opsForValue().get(key);
            return Optional.ofNullable(secret);
        } catch (Exception e) {
            handleRedisException("Error fetching pending enrollment secret from Redis", e);
            return Optional.empty();
        }
    }

    public void deletePendingEnrollmentSecret(Long userId) {
        try {
            String key = "iam:mfa:enrollment:" + userId;
            redisTemplate.delete(key);
        } catch (Exception e) {
            handleRedisException("Error deleting pending enrollment secret from Redis", e);
        }
    }

    private void handleRedisException(String contextMsg, Exception e) {
        log.error("{}: {}", contextMsg, e.getMessage());
        if (redisRequired) {
            throw new RedisUnavailableException("Redis session service unavailable: " + e.getMessage(), e);
        }
    }
}

