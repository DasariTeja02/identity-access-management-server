package com.iam.service;

import com.iam.dto.AuthorityDto;
import com.iam.dto.RoleDto;
import com.iam.dto.UserDto;
import com.iam.entity.Authority;
import com.iam.entity.Role;
import com.iam.entity.User;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class UserMapper {

    public UserDto toUserDto(User user) {
        if (user == null) {
            return null;
        }

        Set<String> roleNames = user.getRoles() != null
                ? user.getRoles().stream().map(Role::getName).collect(Collectors.toSet())
                : Collections.emptySet();

        Set<String> authorityNames = new HashSet<>();
        if (user.getRoles() != null) {
            for (Role role : user.getRoles()) {
                if (role.getAuthorities() != null) {
                    for (Authority auth : role.getAuthorities()) {
                        authorityNames.add(auth.getName());
                    }
                }
            }
        }

        return new UserDto(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.isEnabled(),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                roleNames,
                authorityNames
        );
    }

    public RoleDto toRoleDto(Role role) {
        if (role == null) {
            return null;
        }

        Set<AuthorityDto> authorityDtos = role.getAuthorities() != null
                ? role.getAuthorities().stream().map(this::toAuthorityDto).collect(Collectors.toSet())
                : Collections.emptySet();

        return new RoleDto(role.getId(), role.getName(), role.getDescription(), authorityDtos);
    }

    public AuthorityDto toAuthorityDto(Authority authority) {
        if (authority == null) {
            return null;
        }
        return new AuthorityDto(authority.getId(), authority.getName(), authority.getDescription());
    }
}
