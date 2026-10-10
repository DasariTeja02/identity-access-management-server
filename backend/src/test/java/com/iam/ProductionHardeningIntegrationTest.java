package com.iam;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iam.service.RateLimitingService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
public class ProductionHardeningIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private RateLimitingService rateLimitingService;

    @Test
    @DisplayName("Actuator /actuator/health should return UP status and 200 OK")
    void actuatorHealth_shouldReturn200AndUpStatus() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Actuator Liveness probe /actuator/health/liveness should return 200 OK")
    void actuatorLivenessProbe_shouldReturn200() throws Exception {
        mockMvc.perform(get("/actuator/health/liveness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Actuator Readiness probe /actuator/health/readiness should return 200 OK")
    void actuatorReadinessProbe_shouldReturn200() throws Exception {
        mockMvc.perform(get("/actuator/health/readiness"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Actuator /actuator/prometheus should be accessible and return Prometheus metrics format")
    void actuatorPrometheus_shouldReturn200AndMetrics() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("jvm_memory_used_bytes")));
    }

    @Test
    @DisplayName("OpenAPI 3.0 specification /v3/api-docs should be exposed and contain IAM API definitions")
    void openApiDocs_shouldReturn200AndJsonSpec() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.openapi", notNullValue()))
                .andExpect(jsonPath("$.info.title", containsString("Identity & Access Management (IAM)")));
    }

    @Test
    @DisplayName("Swagger UI /swagger-ui/index.html should be accessible")
    void swaggerUi_shouldReturn200() throws Exception {
        mockMvc.perform(get("/swagger-ui/index.html"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Security headers (CSP, nosniff, SAMEORIGIN, Referrer, Permissions) must be present on responses")
    void securityHeaders_shouldBeConfigured() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "SAMEORIGIN"))
                .andExpect(header().string("Referrer-Policy", "strict-origin-when-cross-origin"))
                .andExpect(header().string("Permissions-Policy", "camera=(), microphone=(), geolocation=()"))
                .andExpect(header().exists("Content-Security-Policy"));
    }

    @Test
    @DisplayName("Production error handling: Malformed JSON must not leak stack traces or internal classes")
    void malformedPayload_shouldReturnStructuredErrorWithoutStackTrace() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\": \"test\", \"password\": malformed-json}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").exists())
                .andExpect(jsonPath("$.stackTrace").doesNotExist())
                .andExpect(jsonPath("$.trace").doesNotExist());
    }

    @Test
    @DisplayName("Rate limiting service should enforce limits and return 429 when threshold exceeded")
    void rateLimitingService_shouldBlockExcessRequests() {
        String testKey = "test-client-ip-" + System.currentTimeMillis();
        int maxAllowed = 3;

        // 3 requests within limit
        for (int i = 0; i < maxAllowed; i++) {
            RateLimitingService.RateLimitResult res = rateLimitingService.checkRateLimit("test", testKey, maxAllowed, 60);
            assertTrue(res.isAllowed(), "Request " + (i + 1) + " should be allowed");
        }

        // 4th request must be rejected
        RateLimitingService.RateLimitResult blockedRes = rateLimitingService.checkRateLimit("test", testKey, maxAllowed, 60);
        assertFalse(blockedRes.isAllowed(), "Request exceeding limit must be blocked");
        assertTrue(blockedRes.getRetryAfterSeconds() > 0, "Retry-After must be positive");
    }
}
