package com.iam.security;

import com.iam.service.RedisSessionService;
import com.iam.service.SessionManagerService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Filter that validates session active status and token revocation status
 * on every protected request. Rejects revoked sessions and blacklisted JWT tokens.
 */
@Component
public class SessionAndTokenValidationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(SessionAndTokenValidationFilter.class);

    private final SessionManagerService sessionManagerService;
    private final RedisSessionService redisSessionService;
    private final JwtDecoder jwtDecoder;

    public SessionAndTokenValidationFilter(SessionManagerService sessionManagerService,
                                           RedisSessionService redisSessionService,
                                           JwtDecoder jwtDecoder) {
        this.sessionManagerService = sessionManagerService;
        this.redisSessionService = redisSessionService;
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/api/auth/login") ||
               path.startsWith("/api/auth/register") ||
               path.startsWith("/oauth2/token") ||
               path.startsWith("/oauth2/jwks") ||
               path.startsWith("/.well-known") ||
               path.startsWith("/h2-console") ||
               path.startsWith("/actuator");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        // 1. Check Bearer Token Revocation
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String tokenValue = authHeader.substring(7).trim();
            try {
                Jwt jwt = jwtDecoder.decode(tokenValue);
                String jti = jwt.getId();
                if (jti != null && redisSessionService.isTokenRevoked(jti)) {
                    log.warn("Rejected request with revoked JWT token jti={}", jti);
                    sendUnauthorized(response, request.getRequestURI(), "Token has been revoked");
                    return;
                }

                String sid = jwt.getClaimAsString("sid");
                if (sid != null && (!sessionManagerService.isSessionValid(sid) || redisSessionService.isSessionRevoked(sid))) {
                    log.warn("Rejected request with revoked JWT session sid={}", sid);
                    sendUnauthorized(response, request.getRequestURI(), "Session associated with this token has been revoked");
                    return;
                }
            } catch (Exception e) {
                // If decoding fails, resource server filter will handle it
                log.debug("Bearer token could not be pre-decoded for revocation check: {}", e.getMessage());
            }
        }

        // 2. Check Cookie / HttpSession Active & Revocation Status
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object sidObj = session.getAttribute("IAM_SESSION_ID");
            if (sidObj != null) {
                String sessionId = sidObj.toString();
                if (!sessionManagerService.isSessionValid(sessionId) || redisSessionService.isSessionRevoked(sessionId)) {
                    log.warn("Detected revoked or expired session: sessionId={}", sessionId);
                    session.invalidate();
                    SecurityContextHolder.clearContext();

                    // If requesting a protected resource, block it immediately
                    if (isProtectedPath(request.getRequestURI())) {
                        sendUnauthorized(response, request.getRequestURI(), "Your session has been revoked or expired. Please login again.");
                        return;
                    }
                } else {
                    // Touch active session
                    sessionManagerService.touchSession(sessionId);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean isProtectedPath(String path) {
        return path.startsWith("/api/sessions") ||
               path.startsWith("/api/admin") ||
               path.startsWith("/api/auth/me") ||
               path.startsWith("/api/oauth2/protected") ||
               path.startsWith("/api/dashboard");
    }

    private void sendUnauthorized(HttpServletResponse response, String path, String message) throws IOException {
        SecurityContextHolder.clearContext();
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"success\":false,\"status\":401,\"error\":\"Unauthorized\",\"message\":\"" + message + "\",\"path\":\"" + path + "\"}");
    }
}
