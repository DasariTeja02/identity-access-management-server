package com.iam.controller;

import com.iam.dto.AdminDashboardStatsDto;
import com.iam.dto.ApiResponse;
import com.iam.service.AdminUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/stats")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDashboardController {

    private final AdminUserService adminUserService;

    public AdminDashboardController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<AdminDashboardStatsDto>> getStats() {
        AdminDashboardStatsDto stats = adminUserService.getDashboardStats();
        return ResponseEntity.ok(ApiResponse.ok("Admin dashboard statistics retrieved successfully", stats));
    }
}
