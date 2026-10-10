package com.iam.controller;

import com.iam.dto.*;
import com.iam.entity.User;
import com.iam.exception.ResourceNotFoundException;
import com.iam.repository.UserRepository;
import com.iam.security.CustomUserDetails;
import com.iam.service.MfaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mfa")
public class MfaController {

    private final MfaService mfaService;
    private final UserRepository userRepository;

    public MfaController(MfaService mfaService, UserRepository userRepository) {
        this.mfaService = mfaService;
        this.userRepository = userRepository;
    }

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<MfaStatusResponse>> getMfaStatus() {
        User user = getAuthenticatedUser();
        MfaStatusResponse status = mfaService.getStatus(user);
        return ResponseEntity.ok(ApiResponse.ok("MFA status retrieved successfully", status));
    }

    @PostMapping("/enroll")
    public ResponseEntity<ApiResponse<MfaEnrollmentResponse>> startEnrollment(HttpServletRequest request) {
        User user = getAuthenticatedUser();
        MfaEnrollmentResponse enrollment = mfaService.startEnrollment(user, request);
        return ResponseEntity.ok(ApiResponse.ok("MFA enrollment initiated", enrollment));
    }

    @PostMapping("/verify-enrollment")
    public ResponseEntity<ApiResponse<MfaEnrollmentSuccessResponse>> verifyEnrollment(
            @Valid @RequestBody MfaVerifyEnrollmentRequest body,
            HttpServletRequest request) {
        User user = getAuthenticatedUser();
        MfaEnrollmentSuccessResponse result = mfaService.verifyEnrollment(user, body.getCode(), request);
        return ResponseEntity.ok(ApiResponse.ok("MFA enrollment verified and enabled", result));
    }

    @PostMapping("/challenge/verify")
    public ResponseEntity<AuthResponse> verifyChallenge(
            @Valid @RequestBody MfaChallengeVerifyRequest body,
            HttpServletRequest request) {
        AuthResponse response = mfaService.verifyChallenge(body, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/disable")
    public ResponseEntity<ApiResponse<Void>> disableMfa(
            @RequestBody MfaDisableRequest body,
            HttpServletRequest request) {
        User user = getAuthenticatedUser();
        mfaService.disableMfa(user, body, request);
        return ResponseEntity.ok(ApiResponse.ok("MFA has been successfully disabled"));
    }

    @PostMapping("/recovery-codes/regenerate")
    public ResponseEntity<ApiResponse<List<String>>> regenerateRecoveryCodes(
            @RequestBody MfaRegenerateRecoveryCodesRequest body,
            HttpServletRequest request) {
        User user = getAuthenticatedUser();
        List<String> newCodes = mfaService.regenerateRecoveryCodes(user, body, request);
        return ResponseEntity.ok(ApiResponse.ok("Recovery codes regenerated successfully", newCodes));
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
}
