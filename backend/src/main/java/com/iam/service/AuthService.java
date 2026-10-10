package com.iam.service;

import com.iam.dto.AuthResponse;
import com.iam.dto.LoginRequest;
import com.iam.dto.RegisterRequest;
import com.iam.dto.UserDto;
import com.iam.entity.Role;
import com.iam.entity.User;
import com.iam.exception.ResourceNotFoundException;
import com.iam.exception.UserAlreadyExistsException;
import com.iam.repository.RoleRepository;
import com.iam.repository.UserRepository;
import com.iam.security.CustomUserDetails;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final UserMapper userMapper;
    private final SessionManagerService sessionManagerService;
    private final com.iam.repository.UserMfaSettingsRepository userMfaSettingsRepository;
    private final MfaService mfaService;

    public AuthService(UserRepository userRepository,
                       RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager,
                       UserMapper userMapper,
                       SessionManagerService sessionManagerService,
                       com.iam.repository.UserMfaSettingsRepository userMfaSettingsRepository,
                       MfaService mfaService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.userMapper = userMapper;
        this.sessionManagerService = sessionManagerService;
        this.userMfaSettingsRepository = userMfaSettingsRepository;
        this.mfaService = mfaService;
    }

    @Transactional
    public UserDto register(RegisterRequest request) {
        log.info("Processing registration request for username: {}", request.getUsername());

        if (userRepository.existsByUsername(request.getUsername().trim())) {
            throw new UserAlreadyExistsException("Username '" + request.getUsername() + "' is already taken.");
        }

        if (userRepository.existsByEmail(request.getEmail().trim().toLowerCase())) {
            throw new UserAlreadyExistsException("Email '" + request.getEmail() + "' is already registered.");
        }

        User user = new User();
        user.setUsername(request.getUsername().trim());
        user.setEmail(request.getEmail().trim().toLowerCase());
        // BCrypt hash password
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFirstName(request.getFirstName() != null ? request.getFirstName().trim() : null);
        user.setLastName(request.getLastName() != null ? request.getLastName().trim() : null);
        user.setEnabled(true);
        user.setAccountNonExpired(true);
        user.setAccountNonLocked(true);
        user.setCredentialsNonExpired(true);

        // Assign default ROLE_USER
        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> {
                    Role newRole = new Role("ROLE_USER", "Standard application user");
                    return roleRepository.save(newRole);
                });

        user.setRoles(new HashSet<>());
        user.addRole(userRole);

        User savedUser = userRepository.save(user);
        log.info("User registered successfully with ID: {}", savedUser.getId());

        return userMapper.toUserDto(savedUser);
    }

    public AuthResponse login(LoginRequest request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String identifier = request.getUsernameOrEmail().trim();
        log.info("Attempting authentication for identifier: {}", identifier);

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(identifier, request.getPassword())
        );

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        User user = userRepository.findById(userDetails.getId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found after authentication"));

        // Phase 5: Check if MFA is enabled
        if (userMfaSettingsRepository.existsByUserIdAndMfaEnabledTrue(user.getId())) {
            log.info("Primary credentials valid for user: {}. Initiating MFA challenge.", user.getUsername());
            SecurityContextHolder.clearContext();
            return mfaService.createLoginChallenge(user, httpRequest);
        }

        SecurityContext securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(authentication);
        SecurityContextHolder.setContext(securityContext);

        String sessionId = java.util.UUID.randomUUID().toString();
        if (httpRequest != null) {
            HttpSession session = httpRequest.getSession(true);
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, securityContext);
            session.setAttribute("IAM_SESSION_ID", sessionId);
        }

        sessionManagerService.createSession(user, sessionId, "iam-web-portal", httpRequest);

        UserDto userDto = userMapper.toUserDto(user);
        log.info("Authentication successful for user: {}", user.getUsername());

        return new AuthResponse(true, "Authentication successful", userDto, sessionId);
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated() || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new ResourceNotFoundException("No authenticated user in current session");
        }

        String username;
        if (authentication.getPrincipal() instanceof CustomUserDetails customUserDetails) {
            username = customUserDetails.getUsername();
        } else {
            username = authentication.getName();
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("Authenticated user not found in database: " + username));

        return userMapper.toUserDto(user);
    }

    public void logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String sessionId = null;
        if (httpRequest != null) {
            sessionId = httpRequest.getHeader("X-Session-Id");
            HttpSession session = httpRequest.getSession(false);
            if (session != null) {
                if (sessionId == null) {
                    Object sidAttr = session.getAttribute("IAM_SESSION_ID");
                    if (sidAttr != null) {
                        sessionId = sidAttr.toString();
                    }
                }
                session.invalidate();
            }
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && !"anonymousUser".equals(authentication.getPrincipal())) {
            String username = authentication.getName();
            userRepository.findByUsername(username).ifPresent(user -> {
                sessionManagerService.recordSecurityEvent("LOGOUT", user.getId(), user.getUsername(), null, httpRequest != null ? httpRequest.getRemoteAddr() : null, "User initiated logout");
            });
        }

        if (sessionId != null) {
            try {
                sessionManagerService.revokeSession(sessionId, "LOGOUT", null, true);
            } catch (Exception e) {
                log.warn("Could not mark session {} as revoked during logout: {}", sessionId, e.getMessage());
            }
        }

        SecurityContextHolder.clearContext();
        log.info("User session logged out successfully");
    }
}
