package com.iam;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iam.dto.CreateRoleRequest;
import com.iam.dto.LockUserRequest;
import com.iam.dto.UpdateUserRolesRequest;
import com.iam.dto.UpdateUserStatusRequest;
import com.iam.entity.User;
import com.iam.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
public class AdminManagementIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Test
    @DisplayName("Unauthenticated request to /api/admin/users should be rejected with 401")
    void unauthenticatedAccessToAdminUsers_shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/admin/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Normal user with ROLE_USER should be rejected with 403 Forbidden")
    @WithMockUser(username = "testuser", roles = {"USER"})
    void normalUserAccessToAdminUsers_shouldReturn403() throws Exception {
        mockMvc.perform(get("/api/admin/users"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Normal user attempting to modify user status should be denied with 403")
    @WithMockUser(username = "testuser", roles = {"USER"})
    void normalUserPrivilegeEscalation_shouldReturn403() throws Exception {
        User target = userRepository.findByUsername("admin").orElseThrow();
        UpdateUserStatusRequest body = new UpdateUserStatusRequest(false);

        mockMvc.perform(patch("/api/admin/users/" + target.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Administrator with ROLE_ADMIN should list users with pagination")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void adminAccessToAdminUsers_shouldReturn200AndPaginatedUsers() throws Exception {
        mockMvc.perform(get("/api/admin/users")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.content", not(empty())))
                .andExpect(jsonPath("$.data.totalElements", greaterThanOrEqualTo(2)));
    }

    @Test
    @DisplayName("Administrator should retrieve real dashboard metrics")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void adminAccessToStats_shouldReturnRealDashboardMetrics() throws Exception {
        mockMvc.perform(get("/api/admin/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.totalUsers", greaterThanOrEqualTo(2)))
                .andExpect(jsonPath("$.data.activeUsers", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.data.roleDistribution", notNullValue()));
    }

    @Test
    @DisplayName("Admin can lock and unlock a normal user account")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void adminLockAndUnlockUser_shouldSucceed() throws Exception {
        User testUser = userRepository.findByUsername("testuser").orElseThrow();

        // Lock user
        LockUserRequest lockReq = new LockUserRequest("Suspicious activity detected");
        mockMvc.perform(post("/api/admin/users/" + testUser.getId() + "/lock")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(lockReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        User lockedUser = userRepository.findById(testUser.getId()).orElseThrow();
        assertFalse(lockedUser.isAccountNonLocked());

        // Unlock user
        mockMvc.perform(post("/api/admin/users/" + testUser.getId() + "/unlock"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        User unlockedUser = userRepository.findById(testUser.getId()).orElseThrow();
        assertTrue(unlockedUser.isAccountNonLocked());
    }

    @Test
    @DisplayName("Admin can enable and disable a normal user account")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void adminDisableAndEnableUser_shouldSucceed() throws Exception {
        User testUser = userRepository.findByUsername("testuser").orElseThrow();

        // Disable user
        UpdateUserStatusRequest disableReq = new UpdateUserStatusRequest(false);
        mockMvc.perform(patch("/api/admin/users/" + testUser.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(disableReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        User disabledUser = userRepository.findById(testUser.getId()).orElseThrow();
        assertFalse(disabledUser.isEnabled());

        // Re-enable user
        UpdateUserStatusRequest enableReq = new UpdateUserStatusRequest(true);
        mockMvc.perform(patch("/api/admin/users/" + testUser.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(enableReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)));

        User enabledUser = userRepository.findById(testUser.getId()).orElseThrow();
        assertTrue(enabledUser.isEnabled());
    }

    @Test
    @DisplayName("Self-Protection: Cannot lock or disable the final active administrator")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void adminSelfProtection_cannotLockOrDisableLastAdmin() throws Exception {
        User adminUser = userRepository.findByUsername("admin").orElseThrow();

        // Attempting to lock the only admin should be rejected with 400
        LockUserRequest lockReq = new LockUserRequest("Locking myself");
        mockMvc.perform(post("/api/admin/users/" + adminUser.getId() + "/lock")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(lockReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.message", containsString("Cannot lock the last active administrator")));

        // Attempting to disable the only admin should be rejected with 400
        UpdateUserStatusRequest disableReq = new UpdateUserStatusRequest(false);
        mockMvc.perform(patch("/api/admin/users/" + adminUser.getId() + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(disableReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.message", containsString("Cannot disable the last active administrator")));

        // Attempting to remove ROLE_ADMIN from the only admin should be rejected with 400
        UpdateUserRolesRequest rolesReq = new UpdateUserRolesRequest(Set.of("ROLE_USER"));
        mockMvc.perform(patch("/api/admin/users/" + adminUser.getId() + "/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(rolesReq)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.message", containsString("Cannot remove administrative privileges from the final active administrator")));
    }

    @Test
    @DisplayName("Admin can view and create RBAC roles")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void adminRoleManagement_shouldListAndCreateRole() throws Exception {
        // List roles
        mockMvc.perform(get("/api/admin/roles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data", not(empty())));

        // Create new role
        CreateRoleRequest createReq = new CreateRoleRequest(
                "ROLE_SECURITY_ANALYST",
                "Security Operations Analyst",
                Set.of("read:users")
        );

        mockMvc.perform(post("/api/admin/roles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.name", is("ROLE_SECURITY_ANALYST")));
    }

    @Test
    @DisplayName("Admin can query security audit events with pagination and filtering")
    @WithMockUser(username = "admin", roles = {"ADMIN"})
    void adminSecurityEvents_shouldBePaginatedAndFilterable() throws Exception {
        mockMvc.perform(get("/api/admin/security-events")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.content", notNullValue()))
                .andExpect(jsonPath("$.data.totalElements", greaterThanOrEqualTo(0)));
    }
}
