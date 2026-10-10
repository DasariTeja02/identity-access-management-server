package com.iam.controller;

import com.iam.dto.*;
import com.iam.service.AdminUserService;
import com.iam.service.SessionManagerService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;
    private final SessionManagerService sessionManagerService;

    public AdminUserController(AdminUserService adminUserService,
                               SessionManagerService sessionManagerService) {
        this.adminUserService = adminUserService;
        this.sessionManagerService = sessionManagerService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AdminUserSummaryDto>>> getUsers(
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "mfa", required = false) String mfa,
            @RequestParam(value = "role", required = false) String role,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size,
            @RequestParam(value = "sortBy", defaultValue = "createdAt") String sortBy,
            @RequestParam(value = "sortDir", defaultValue = "desc") String sortDir) {

        Sort sort = "asc".equalsIgnoreCase(sortDir) ? Sort.by(sortBy).ascending() : Sort.by(sortBy).descending();
        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)), sort);

        PageResponse<AdminUserSummaryDto> result = adminUserService.getUsers(search, status, mfa, role, pageable);
        return ResponseEntity.ok(ApiResponse.ok("Users retrieved successfully", result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AdminUserDetailDto>> getUserDetail(@PathVariable("id") Long id) {
        AdminUserDetailDto detail = adminUserService.getUserDetail(id);
        return ResponseEntity.ok(ApiResponse.ok("User detail retrieved successfully", detail));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<Void>> updateUserStatus(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateUserStatusRequest request,
            HttpServletRequest httpRequest) {
        String adminUsername = getAdminUsername();
        adminUserService.updateUserStatus(id, request.getEnabled(), adminUsername, httpRequest);
        String action = request.getEnabled() ? "enabled" : "disabled";
        return ResponseEntity.ok(ApiResponse.ok("User account has been " + action + " successfully"));
    }

    @PostMapping("/{id}/lock")
    public ResponseEntity<ApiResponse<Void>> lockUser(
            @PathVariable("id") Long id,
            @RequestBody(required = false) LockUserRequest request,
            HttpServletRequest httpRequest) {
        String adminUsername = getAdminUsername();
        String reason = request != null ? request.getReason() : "Administrative action";
        adminUserService.lockUser(id, reason, adminUsername, httpRequest);
        return ResponseEntity.ok(ApiResponse.ok("User account has been locked and active sessions revoked"));
    }

    @PostMapping("/{id}/unlock")
    public ResponseEntity<ApiResponse<Void>> unlockUser(
            @PathVariable("id") Long id,
            HttpServletRequest httpRequest) {
        String adminUsername = getAdminUsername();
        adminUserService.unlockUser(id, adminUsername, httpRequest);
        return ResponseEntity.ok(ApiResponse.ok("User account has been unlocked successfully"));
    }

    @PatchMapping("/{id}/roles")
    public ResponseEntity<ApiResponse<Void>> updateUserRoles(
            @PathVariable("id") Long id,
            @Valid @RequestBody UpdateUserRolesRequest request,
            HttpServletRequest httpRequest) {
        String adminUsername = getAdminUsername();
        adminUserService.updateUserRoles(id, request.getRoleNames(), adminUsername, httpRequest);
        return ResponseEntity.ok(ApiResponse.ok("User roles updated successfully"));
    }

    @GetMapping("/{id}/sessions")
    public ResponseEntity<ApiResponse<List<SessionDto>>> getUserSessions(@PathVariable("id") Long id) {
        List<SessionDto> sessions = sessionManagerService.getSessionsByUserId(id);
        return ResponseEntity.ok(ApiResponse.ok("User active sessions retrieved successfully", sessions));
    }

    @DeleteMapping("/{id}/sessions")
    public ResponseEntity<ApiResponse<Void>> revokeAllUserSessions(
            @PathVariable("id") Long id,
            HttpServletRequest httpRequest) {
        String adminUsername = getAdminUsername();
        sessionManagerService.revokeAllUserSessions(id, "ADMIN (" + adminUsername + ")", null, true);
        return ResponseEntity.ok(ApiResponse.ok("All active sessions for user revoked successfully"));
    }

    @DeleteMapping("/{id}/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Void>> revokeUserSession(
            @PathVariable("id") Long id,
            @PathVariable("sessionId") String sessionId,
            HttpServletRequest httpRequest) {
        String adminUsername = getAdminUsername();
        sessionManagerService.revokeSession(sessionId, "ADMIN (" + adminUsername + ")", null, true);
        return ResponseEntity.ok(ApiResponse.ok("Session revoked successfully"));
    }

    private String getAdminUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "ADMIN";
    }
}
