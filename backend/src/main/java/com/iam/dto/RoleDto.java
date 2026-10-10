package com.iam.dto;

import java.util.Set;

public class RoleDto {
    private Long id;
    private String name;
    private String description;
    private Set<String> authorities;
    private long userCount;

    public RoleDto() {
    }

    public RoleDto(Long id, String name, String description, Set<String> authorities, long userCount) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.authorities = authorities;
        this.userCount = userCount;
    }

    public RoleDto(Long id, String name, String description, java.util.Set<AuthorityDto> authorityDtos) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.authorities = authorityDtos != null
                ? authorityDtos.stream().map(AuthorityDto::getName).collect(java.util.stream.Collectors.toSet())
                : java.util.Set.of();
        this.userCount = 0;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Set<String> getAuthorities() {
        return authorities;
    }

    public void setAuthorities(Set<String> authorities) {
        this.authorities = authorities;
    }

    public long getUserCount() {
        return userCount;
    }

    public void setUserCount(long userCount) {
        this.userCount = userCount;
    }
}
