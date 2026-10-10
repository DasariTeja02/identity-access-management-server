package com.iam.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Set;

public class CreateRoleRequest {

    @NotBlank(message = "Role name is required")
    @Size(min = 2, max = 50, message = "Role name must be between 2 and 50 characters")
    private String name;

    @Size(max = 255, message = "Description must not exceed 255 characters")
    private String description;

    private Set<String> authorityNames;

    public CreateRoleRequest() {
    }

    public CreateRoleRequest(String name, String description, Set<String> authorityNames) {
        this.name = name;
        this.description = description;
        this.authorityNames = authorityNames;
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

    public Set<String> getAuthorityNames() {
        return authorityNames;
    }

    public void setAuthorityNames(Set<String> authorityNames) {
        this.authorityNames = authorityNames;
    }
}
