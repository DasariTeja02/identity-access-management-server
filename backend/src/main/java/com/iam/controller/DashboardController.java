package com.iam.controller;

import com.iam.dto.ApiResponse;
import com.iam.dto.UserDto;
import com.iam.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final AuthService authService;

    public DashboardController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDashboardSummary() {
        UserDto currentUser = authService.getCurrentUser();

        Map<String, Object> summary = new HashMap<>();
        summary.put("user", currentUser);
        summary.put("serverTime", Instant.now().toString());
        summary.put("iamVersion", "1.0.0-phase1");
        summary.put("environment", "production-ready");
        summary.put("authFlow", "Spring Security Session & Basic Auth");
        summary.put("featuresActive", new String[]{
                "Database Persistence (PostgreSQL/H2)",
                "BCrypt Password Hashing (Cost factor 12)",
                "Role-Based Access Control (RBAC)",
                "Authority & Permission Mapping",
                "Input Validation & Sanitation",
                "Centralized Exception Handling"
        });

        return ResponseEntity.ok(ApiResponse.ok("Dashboard summary retrieved successfully", summary));
    }
}
