package com.iam.service;

import com.iam.dto.CreateRoleRequest;
import com.iam.dto.RoleDto;
import com.iam.entity.Authority;
import com.iam.entity.Role;
import com.iam.repository.AuthorityRepository;
import com.iam.repository.RoleRepository;
import com.iam.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AdminRoleService {

    private static final Logger log = LoggerFactory.getLogger(AdminRoleService.class);

    private final RoleRepository roleRepository;
    private final AuthorityRepository authorityRepository;
    private final UserRepository userRepository;
    private final SessionManagerService sessionManagerService;

    public AdminRoleService(RoleRepository roleRepository,
                            AuthorityRepository authorityRepository,
                            UserRepository userRepository,
                            SessionManagerService sessionManagerService) {
        this.roleRepository = roleRepository;
        this.authorityRepository = authorityRepository;
        this.userRepository = userRepository;
        this.sessionManagerService = sessionManagerService;
    }

    @Transactional(readOnly = true)
    public List<RoleDto> getAllRoles() {
        return roleRepository.findAll().stream().map(role -> {
            Set<String> authNames = role.getAuthorities() != null ?
                    role.getAuthorities().stream().map(Authority::getName).collect(Collectors.toSet()) :
                    Set.of();
            long userCount = userRepository.countByRoleName(role.getName());
            return new RoleDto(role.getId(), role.getName(), role.getDescription(), authNames, userCount);
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Authority> getAllAuthorities() {
        return authorityRepository.findAll();
    }

    @Transactional
    public RoleDto createRole(CreateRoleRequest request, String adminUsername, HttpServletRequest httpRequest) {
        String rawName = request.getName().trim().toUpperCase();
        String roleName = rawName.startsWith("ROLE_") ? rawName : "ROLE_" + rawName;

        if (roleRepository.findByName(roleName).isPresent()) {
            throw new IllegalArgumentException("Role with name '" + roleName + "' already exists.");
        }

        Set<Authority> authorities = new HashSet<>();
        if (request.getAuthorityNames() != null) {
            for (String authName : request.getAuthorityNames()) {
                authorityRepository.findByName(authName.trim().toUpperCase())
                        .ifPresent(authorities::add);
            }
        }

        Role role = new Role(roleName, request.getDescription() != null ? request.getDescription().trim() : null);
        role.setAuthorities(authorities);
        Role saved = roleRepository.save(role);

        sessionManagerService.recordSecurityEvent(
                "ADMIN_ROLE_CREATED", null, adminUsername, null, extractClientIp(httpRequest),
                "Role created: " + roleName + " with " + authorities.size() + " authorities"
        );
        log.info("Admin '{}' created new role '{}'", adminUsername, roleName);

        Set<String> authNames = authorities.stream().map(Authority::getName).collect(Collectors.toSet());
        return new RoleDto(saved.getId(), saved.getName(), saved.getDescription(), authNames, 0);
    }

    private String extractClientIp(HttpServletRequest request) {
        if (request == null) return "127.0.0.1";
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) return xf.split(",")[0].trim();
        return request.getRemoteAddr() != null ? request.getRemoteAddr() : "127.0.0.1";
    }
}
