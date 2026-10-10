package com.iam.controller;

import com.iam.dto.ApiResponse;
import com.iam.dto.SecurityEventDto;
import com.iam.dto.SessionDto;
import com.iam.exception.ResourceNotFoundException;
import com.iam.repository.UserSessionRepository;
import com.iam.service.SessionManagerService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSessionController {

    private final SessionManagerService sessionManagerService;
    private final UserSessionRepository sessionRepository;
    private final com.iam.service.AdminAuditService adminAuditService;

    public AdminSessionController(SessionManagerService sessionManagerService,
                                  UserSessionRepository sessionRepository,
                                  com.iam.service.AdminAuditService adminAuditService) {
        this.sessionManagerService = sessionManagerService;
        this.sessionRepository = sessionRepository;
        this.adminAuditService = adminAuditService;
    }

    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<List<SessionDto>>> getAllSessions(HttpServletRequest request) {
        String currentSessionId = extractCurrentSessionId(request);
        List<SessionDto> sessions = sessionManagerService.getAllSessions(currentSessionId);
        return ResponseEntity.ok(ApiResponse.ok("All system sessions retrieved successfully", sessions));
    }

    @PostMapping("/sessions/{id}/revoke")
    public ResponseEntity<ApiResponse<Void>> revokeSessionByAdmin(@PathVariable("id") Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String adminUsername = auth != null ? auth.getName() : "ADMIN";

        var sessionEntity = sessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found with ID: " + id));

        sessionManagerService.revokeSession(sessionEntity.getSessionId(), "ADMIN (" + adminUsername + ")", null, true);
        return ResponseEntity.ok(ApiResponse.ok("Session revoked by administrator successfully"));
    }

    @PostMapping("/users/{userId}/sessions/revoke")
    public ResponseEntity<ApiResponse<Void>> revokeAllUserSessionsByAdmin(@PathVariable("userId") Long userId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String adminUsername = auth != null ? auth.getName() : "ADMIN";

        sessionManagerService.revokeAllUserSessions(userId, "ADMIN (" + adminUsername + ")", null, true);
        return ResponseEntity.ok(ApiResponse.ok("All sessions for user revoked by administrator successfully"));
    }

    @GetMapping("/security-events")
    public ResponseEntity<ApiResponse<com.iam.dto.PageResponse<SecurityEventDto>>> getSecurityEvents(
            @RequestParam(value = "eventType", required = false) String eventType,
            @RequestParam(value = "username", required = false) String username,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "sortDir", defaultValue = "desc") String sortDir) {

        org.springframework.data.domain.Sort sort = "asc".equalsIgnoreCase(sortDir) ?
                org.springframework.data.domain.Sort.by("timestamp").ascending() :
                org.springframework.data.domain.Sort.by("timestamp").descending();
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)), sort);

        com.iam.dto.PageResponse<SecurityEventDto> events = adminAuditService.getSecurityEvents(eventType, username, search, null, null, pageable);
        return ResponseEntity.ok(ApiResponse.ok("Security events retrieved successfully", events));
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
