package com.iam.controller;

import com.iam.dto.AdminMfaUserDto;
import com.iam.dto.ApiResponse;
import com.iam.service.MfaService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/mfa")
@PreAuthorize("hasRole('ADMIN')")
public class AdminMfaController {

    private final MfaService mfaService;

    public AdminMfaController(MfaService mfaService) {
        this.mfaService = mfaService;
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<AdminMfaUserDto>>> getAllUsersMfaStatus() {
        List<AdminMfaUserDto> users = mfaService.adminGetUsers();
        return ResponseEntity.ok(ApiResponse.ok("MFA user status list retrieved successfully", users));
    }

    @PostMapping("/users/{userId}/reset")
    public ResponseEntity<ApiResponse<Void>> resetUserMfa(
            @PathVariable("userId") Long userId,
            HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String adminUsername = auth != null ? auth.getName() : "ADMIN";

        mfaService.adminResetMfa(userId, adminUsername, request);
        return ResponseEntity.ok(ApiResponse.ok("MFA successfully reset for user. All active sessions revoked."));
    }
}
