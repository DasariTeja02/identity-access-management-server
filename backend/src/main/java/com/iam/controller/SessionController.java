package com.iam.controller;

import com.iam.dto.ApiResponse;
import com.iam.dto.SessionDto;
import com.iam.entity.User;
import com.iam.exception.ResourceNotFoundException;
import com.iam.repository.UserSessionRepository;
import com.iam.repository.UserRepository;
import com.iam.security.CustomUserDetails;
import com.iam.service.SessionManagerService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final SessionManagerService sessionManagerService;
    private final UserRepository userRepository;
    private final UserSessionRepository sessionRepository;

    public SessionController(SessionManagerService sessionManagerService,
                             UserRepository userRepository,
                             UserSessionRepository sessionRepository) {
        this.sessionManagerService = sessionManagerService;
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<SessionDto>>> getActiveSessions(HttpServletRequest request) {
        User user = getAuthenticatedUser();
        String currentSessionId = extractCurrentSessionId(request);

        List<SessionDto> sessions = sessionManagerService.getSessionsForUser(user, currentSessionId);
        return ResponseEntity.ok(ApiResponse.ok("Active sessions retrieved successfully", sessions));
    }

    @PostMapping("/{id}/revoke")
    public ResponseEntity<ApiResponse<Void>> revokeSession(@PathVariable("id") Long id,
                                                           HttpServletRequest request) {
        User user = getAuthenticatedUser();
        var sessionEntity = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found with ID: " + id));

        sessionManagerService.revokeSession(sessionEntity.getSessionId(), "USER (" + user.getUsername() + ")", user, false);
        return ResponseEntity.ok(ApiResponse.ok("Session revoked successfully"));
    }

    @PostMapping("/logout-all")
    public ResponseEntity<ApiResponse<Void>> logoutAllSessions(HttpServletRequest request) {
        User user = getAuthenticatedUser();
        sessionManagerService.revokeAllUserSessions(user.getId(), "USER_LOGOUT_ALL (" + user.getUsername() + ")", user, false);

        HttpSession httpSession = request.getSession(false);
        if (httpSession != null) {
            httpSession.invalidate();
        }
        SecurityContextHolder.clearContext();

        return ResponseEntity.ok(ApiResponse.ok("All active sessions revoked successfully"));
    }

    private User getAuthenticatedUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            throw new ResourceNotFoundException("No authenticated user in current context");
        }

        String username;
        if (auth.getPrincipal() instanceof CustomUserDetails cud) {
            username = cud.getUsername();
        } else {
            username = auth.getName();
        }

        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
    }

    private String extractCurrentSessionId(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String sidHeader = request.getHeader("X-Session-Id");
        if (sidHeader != null && !sidHeader.isBlank()) {
            return sidHeader.trim();
        }

        HttpSession session = request.getSession(false);
        if (session != null) {
            Object attr = session.getAttribute("IAM_SESSION_ID");
            if (attr != null) {
                return attr.toString();
            }
        }
        return null;
    }
}
