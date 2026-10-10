package com.iam.controller;

import com.iam.dto.ApiResponse;
import com.iam.dto.CreateRoleRequest;
import com.iam.dto.RoleDto;
import com.iam.entity.Authority;
import com.iam.service.AdminRoleService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminRoleController {

    private final AdminRoleService adminRoleService;

    public AdminRoleController(AdminRoleService adminRoleService) {
        this.adminRoleService = adminRoleService;
    }

    @GetMapping("/roles")
    public ResponseEntity<ApiResponse<List<RoleDto>>> getRoles() {
        List<RoleDto> roles = adminRoleService.getAllRoles();
        return ResponseEntity.ok(ApiResponse.ok("Roles retrieved successfully", roles));
    }

    @PostMapping("/roles")
    public ResponseEntity<ApiResponse<RoleDto>> createRole(
            @Valid @RequestBody CreateRoleRequest request,
            HttpServletRequest httpRequest) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        String adminUsername = auth != null ? auth.getName() : "ADMIN";

        RoleDto created = adminRoleService.createRole(request, adminUsername, httpRequest);
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED)
                .body(ApiResponse.created("Role created successfully", created));
    }

    @GetMapping("/authorities")
    public ResponseEntity<ApiResponse<List<Authority>>> getAuthorities() {
        List<Authority> authorities = adminRoleService.getAllAuthorities();
        return ResponseEntity.ok(ApiResponse.ok("Authorities retrieved successfully", authorities));
    }
}
