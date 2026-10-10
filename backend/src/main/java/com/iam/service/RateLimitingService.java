package com.iam.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Production Redis-backed rate limiting service.
 * Enforces rate limits across authentication, MFA, token exchange, and administrative endpoints.
 * Fallbacks to an in-memory bucket counter if Redis is temporarily unreachable.
 */
@Service
public class RateLimitingService {

    private static final Logger log = LoggerFactory.getLogger(RateLimitingService.class);

    private static final String KEY_PREFIX = "iam:ratelimit:";

    private final StringRedisTemplate redisTemplate;

    @Value("${iam.ratelimit.enabled:true}")
    private boolean enabled;

    // In-memory fallback if Redis is unavailable during local development/tests
    private final ConcurrentHashMap<String, InMemoryBucket> memoryBuckets = new ConcurrentHashMap<>();

    public RateLimitingService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }

    public static class RateLimitResult {
        private final boolean allowed;
        private final long currentCount;
        private final long maxLimit;
        private final long retryAfterSeconds;

        public RateLimitResult(boolean allowed, long currentCount, long maxLimit, long retryAfterSeconds) {
            this.allowed = allowed;
            this.currentCount = currentCount;
            this.maxLimit = maxLimit;
            this.retryAfterSeconds = retryAfterSeconds;
        }

        public boolean isAllowed() {
            return allowed;
        }

        public long getCurrentCount() {
            return currentCount;
        }

        public long getMaxLimit() {
            return maxLimit;
        }

        public long getRetryAfterSeconds() {
            return retryAfterSeconds;
        }
    }

    /**
     * Checks if the given key exceeds maxRequests within the given window seconds.
     *
     * @param category category of endpoint (e.g. "auth", "mfa", "token", "admin")
     * @param clientIdentifier client IP or principal
     * @param maxRequests maximum allowed requests per window
     * @param windowSeconds duration of rate-limit window in seconds
     * @return RateLimitResult indicating if allowed and retry-after header value
     */
    public RateLimitResult checkRateLimit(String category, String clientIdentifier, int maxRequests, int windowSeconds) {
        if (!enabled) {
            return new RateLimitResult(true, 0, maxRequests, 0);
        }

        String sanitizedId = sanitizeIdentifier(clientIdentifier);
        String redisKey = KEY_PREFIX + category + ":" + sanitizedId;

        try {
            Long count = redisTemplate.opsForValue().increment(redisKey);
            if (count != null && count == 1L) {
                redisTemplate.expire(redisKey, Duration.ofSeconds(windowSeconds));
            }

            Long ttl = redisTemplate.getExpire(redisKey);
            long retryAfter = (ttl != null && ttl > 0) ? ttl : windowSeconds;

            if (count != null && count > maxRequests) {
                log.warn("Rate limit exceeded for category '{}', identifier '{}': count={}/{}",
                        category, sanitizedId, count, maxRequests);
                return new RateLimitResult(false, count, maxRequests, retryAfter);
            }

            return new RateLimitResult(true, count != null ? count : 1, maxRequests, 0);

        } catch (Exception e) {
            log.debug("Redis rate limiting error; falling back to in-memory counter: {}", e.getMessage());
            return checkInMemory(redisKey, maxRequests, windowSeconds);
        }
    }

    private RateLimitResult checkInMemory(String key, int maxRequests, int windowSeconds) {
        long now = System.currentTimeMillis();
        InMemoryBucket bucket = memoryBuckets.compute(key, (k, existing) -> {
            if (existing == null || now > existing.expiresAt) {
                return new InMemoryBucket(1, now + (windowSeconds * 1000L));
            }
            existing.count.incrementAndGet();
            return existing;
        });

        int current = bucket.count.get();
        long retryAfter = Math.max(1, (bucket.expiresAt - now) / 1000L);

        if (current > maxRequests) {
            return new RateLimitResult(false, current, maxRequests, retryAfter);
        }
        return new RateLimitResult(true, current, maxRequests, 0);
    }

    private String sanitizeIdentifier(String id) {
        if (id == null || id.isBlank()) {
            return "unknown";
        }
        return id.replaceAll("[^a-zA-Z0-9.:_-]", "_");
    }

    private static class InMemoryBucket {
        final AtomicInteger count;
        final long expiresAt;

        InMemoryBucket(int initialCount, long expiresAt) {
            this.count = new AtomicInteger(initialCount);
            this.expiresAt = expiresAt;
        }
    }
}
