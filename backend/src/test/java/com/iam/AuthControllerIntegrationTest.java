package com.iam;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iam.dto.LoginRequest;
import com.iam.dto.RegisterRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
public class AuthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("Should successfully register a new user")
    void shouldRegisterNewUser() throws Exception {
        RegisterRequest request = new RegisterRequest(
                "sarah_connor",
                "sarah@skynet-resistance.org",
                "SecurePass123!",
                "Sarah",
                "Connor"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.username", is("sarah_connor")))
                .andExpect(jsonPath("$.data.email", is("sarah@skynet-resistance.org")))
                .andExpect(jsonPath("$.data.roles", hasItem("ROLE_USER")));
    }

    @Test
    @DisplayName("Should reject registration with duplicate username")
    void shouldRejectDuplicateUsername() throws Exception {
        // 'admin' is seeded by DataInitializer
        RegisterRequest request = new RegisterRequest(
                "admin",
                "admin2@example.com",
                "Password123!",
                "Test",
                "Admin"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.message", containsString("already taken")));
    }

    @Test
    @DisplayName("Should reject registration with invalid email and short password")
    void shouldRejectInvalidRegistrationData() throws Exception {
        RegisterRequest request = new RegisterRequest(
                "u", // min 3 chars
                "invalid-email",
                "short", // min 8 chars
                "Test",
                "User"
        );

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.validationErrors", notNullValue()));
    }

    @Test
    @DisplayName("Should successfully login with valid credentials")
    void shouldLoginWithValidCredentials() throws Exception {
        // 'testuser' seeded with 'User@123456'
        LoginRequest request = new LoginRequest("testuser", "User@123456");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.user.username", is("testuser")))
                .andExpect(jsonPath("$.user.roles", hasItem("ROLE_USER")));
    }

    @Test
    @DisplayName("Should reject login with invalid password")
    void shouldRejectInvalidPassword() throws Exception {
        LoginRequest request = new LoginRequest("testuser", "WrongPassword!");

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success", is(false)))
                .andExpect(jsonPath("$.message", containsString("Invalid username/email or password")));
    }

    @Test
    @DisplayName("Should reject unauthenticated access to dashboard")
    void shouldRejectUnauthenticatedDashboardAccess() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "admin", roles = {"ADMIN", "USER"})
    @DisplayName("Should allow authenticated user to retrieve dashboard data")
    void shouldAllowAuthenticatedUserToGetDashboardSummary() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success", is(true)))
                .andExpect(jsonPath("$.data.user.username", is("admin")))
                .andExpect(jsonPath("$.data.iamVersion", is("1.0.0-phase1")));
    }
}
