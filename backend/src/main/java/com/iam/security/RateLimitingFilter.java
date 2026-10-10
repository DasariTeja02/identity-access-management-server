package com.iam.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iam.service.RateLimitingService;
import com.iam.service.RateLimitingService.RateLimitResult;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Filter that applies Redis-backed rate limiting to sensitive IAM endpoints.
 * Returns HTTP 429 Too Many Requests when limits are exceeded.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RateLimitingFilter extends OncePerRequestFilter {

    private final RateLimitingService rateLimitingService;
    private final ObjectMapper objectMapper;

    @Value("${iam.ratelimit.auth.limit:20}")
    private int authLimit;

    @Value("${iam.ratelimit.mfa.limit:15}")
    private int mfaLimit;

    @Value("${iam.ratelimit.token.limit:60}")
    private int tokenLimit;

    @Value("${iam.ratelimit.admin.limit:120}")
    private int adminLimit;

    @Value("${iam.ratelimit.window-seconds:60}")
    private int windowSeconds;

    public RateLimitingFilter(RateLimitingService rateLimitingService, ObjectMapper objectMapper) {
        this.rateLimitingService = rateLimitingService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String uri = request.getRequestURI();
        String method = request.getMethod();

        // Skip OPTIONS preflight requests
        if ("OPTIONS".equalsIgnoreCase(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        String clientIp = extractClientIp(request);
        RateLimitResult result = null;

        if (uri.startsWith("/api/auth/login") || uri.startsWith("/api/auth/register")) {
            result = rateLimitingService.checkRateLimit("auth", clientIp, authLimit, windowSeconds);
        } else if (uri.startsWith("/api/mfa/challenge/verify") || uri.startsWith("/api/mfa/verify-enrollment")) {
            result = rateLimitingService.checkRateLimit("mfa", clientIp, mfaLimit, windowSeconds);
        } else if (uri.equals("/oauth2/token")) {
            result = rateLimitingService.checkRateLimit("token", clientIp, tokenLimit, windowSeconds);
        } else if (uri.startsWith("/api/admin/")) {
            result = rateLimitingService.checkRateLimit("admin", clientIp, adminLimit, windowSeconds);
        }

        if (result != null && !result.isAllowed()) {
            sendRateLimitResponse(response, uri, result);
            return;
        }

        if (result != null) {
            response.setHeader("X-RateLimit-Limit", String.valueOf(result.getMaxLimit()));
            response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, result.getMaxLimit() - result.getCurrentCount())));
        }

        filterChain.doFilter(request, response);
    }

    private void sendRateLimitResponse(HttpServletResponse response, String uri, RateLimitResult result) throws IOException {
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("Retry-After", String.valueOf(result.getRetryAfterSeconds()));
        response.setHeader("X-RateLimit-Limit", String.valueOf(result.getMaxLimit()));
        response.setHeader("X-RateLimit-Remaining", "0");

        Map<String, Object> errorBody = new HashMap<>();
        errorBody.put("success", false);
        errorBody.put("status", 429);
        errorBody.put("error", "Too Many Requests");
        errorBody.put("message", "Rate limit exceeded. Please wait " + result.getRetryAfterSeconds() + " seconds before retrying.");
        errorBody.put("path", uri);
        errorBody.put("retryAfterSeconds", result.getRetryAfterSeconds());

        response.getWriter().write(objectMapper.writeValueAsString(errorBody));
    }

    private String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}
