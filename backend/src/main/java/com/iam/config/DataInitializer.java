package com.iam.config;

import com.iam.entity.Authority;
import com.iam.entity.OAuth2Client;
import com.iam.entity.Role;
import com.iam.entity.User;
import com.iam.repository.AuthorityRepository;
import com.iam.repository.OAuth2ClientRepository;
import com.iam.repository.RoleRepository;
import com.iam.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final AuthorityRepository authorityRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final OAuth2ClientRepository clientRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(AuthorityRepository authorityRepository,
                           RoleRepository roleRepository,
                           UserRepository userRepository,
                           OAuth2ClientRepository clientRepository,
                           PasswordEncoder passwordEncoder) {
        this.authorityRepository = authorityRepository;
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.clientRepository = clientRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Initializing IAM Seed Data...");

        // 1. Seed Authorities
        Authority userRead = getOrCreateAuthority("USER_READ", "Read user profile data");
        Authority userWrite = getOrCreateAuthority("USER_WRITE", "Create and update user data");
        Authority roleRead = getOrCreateAuthority("ROLE_READ", "Read role and permission metadata");
        Authority roleWrite = getOrCreateAuthority("ROLE_WRITE", "Manage roles and assignments");
        Authority auditRead = getOrCreateAuthority("AUDIT_READ", "Read audit logs and security events");

        // 2. Seed Roles
        Role userRole = getOrCreateRole("ROLE_USER", "Standard regular user with self-service access", Set.of(userRead));
        Role adminRole = getOrCreateRole("ROLE_ADMIN", "Administrator with full platform access",
                Set.of(userRead, userWrite, roleRead, roleWrite, auditRead));

        // 3. Seed Default Admin User
        if (!userRepository.existsByUsername("admin")) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setEmail("admin@iam.local");
            admin.setPassword(passwordEncoder.encode("Admin@123456"));
            admin.setFirstName("IAM");
            admin.setLastName("Administrator");
            admin.setEnabled(true);
            admin.setRoles(new HashSet<>(Set.of(userRole, adminRole)));
            userRepository.save(admin);
            log.info("Created default administrator user: username='admin', password='Admin@123456'");
        }

        // 4. Seed Default Test User
        if (!userRepository.existsByUsername("testuser")) {
            User testUser = new User();
            testUser.setUsername("testuser");
            testUser.setEmail("testuser@iam.local");
            testUser.setPassword(passwordEncoder.encode("User@123456"));
            testUser.setFirstName("Demo");
            testUser.setLastName("User");
            testUser.setEnabled(true);
            testUser.setRoles(new HashSet<>(Set.of(userRole)));
            userRepository.save(testUser);
            log.info("Created demo user: username='testuser', password='User@123456'");
        }

        // 5. Seed OAuth 2.0 Registered Clients
        seedOAuth2Clients();

        log.info("IAM Seed Data initialization completed.");
    }

    private void seedOAuth2Clients() {
        // Client 1: Confidential Client for Client Credentials Flow (M2M)
        if (!clientRepository.existsByClientId("backend-service")) {
            OAuth2Client m2mClient = new OAuth2Client();
            m2mClient.setId(UUID.randomUUID().toString());
            m2mClient.setClientId("backend-service");
            m2mClient.setClientIdIssuedAt(Instant.now());
            // BCrypt encode client secret
            m2mClient.setClientSecret(passwordEncoder.encode("Secret123!"));
            m2mClient.setClientName("Backend Microservice (Machine-to-Machine)");
            m2mClient.setClientAuthenticationMethods("client_secret_basic,client_secret_post");
            m2mClient.setAuthorizationGrantTypes("client_credentials");
            m2mClient.setScopes("read,write,iam.admin");
            m2mClient.setAccessTokenTimeToLiveSeconds(1800); // 30 minutes
            m2mClient.setRequireAuthorizationConsent(false);
            m2mClient.setRequireProofKeyForCodeExchange(false);

            clientRepository.save(m2mClient);
            log.info("Seeded OAuth2 Client: clientId='backend-service', secret='Secret123!' (Grant: client_credentials)");
        }

        // Client 2: Web Client for Authorization Code, OIDC, and Refresh Token Flow
        OAuth2Client webClient = clientRepository.findByClientId("iam-web-client").orElseGet(OAuth2Client::new);
        if (webClient.getId() == null) {
            webClient.setId(UUID.randomUUID().toString());
            webClient.setClientId("iam-web-client");
            webClient.setClientIdIssuedAt(Instant.now());
            webClient.setClientSecret(passwordEncoder.encode("WebSecret123!"));
            webClient.setClientName("IAM Web Portal (Interactive SPA & OIDC Client)");
        }
        // Support none for public PKCE clients as well as confidential post/basic
        webClient.setClientAuthenticationMethods("client_secret_basic,client_secret_post,none");
        webClient.setAuthorizationGrantTypes("authorization_code,refresh_token");
        webClient.setRedirectUris("http://localhost:5173/oauth2/callback,http://127.0.0.1:5173/oauth2/callback,http://localhost:8080/authorized");
        webClient.setScopes("openid,profile,email,read,write");
        webClient.setAccessTokenTimeToLiveSeconds(900); // 15 minutes
        webClient.setRefreshTokenTimeToLiveSeconds(2592000); // 30 days
        webClient.setReuseRefreshTokens(false); // Enable Refresh Token Rotation
        webClient.setRequireAuthorizationConsent(false);
        webClient.setRequireProofKeyForCodeExchange(true); // PKCE enabled

        clientRepository.save(webClient);
        log.info("Seeded/Updated OAuth2/OIDC Client: clientId='iam-web-client' (Scopes: openid, profile, email, read, write)");
    }

    private Authority getOrCreateAuthority(String name, String description) {
        return authorityRepository.findByName(name)
                .orElseGet(() -> authorityRepository.save(new Authority(name, description)));
    }

    private Role getOrCreateRole(String name, String description, Set<Authority> authorities) {
        return roleRepository.findByName(name)
                .orElseGet(() -> {
                    Role role = new Role(name, description);
                    role.setAuthorities(new HashSet<>(authorities));
                    return roleRepository.save(role);
                });
    }
}
