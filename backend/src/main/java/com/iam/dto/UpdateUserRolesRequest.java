package com.iam.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.Set;

public class UpdateUserRolesRequest {

    @NotEmpty(message = "At least one role must be specified")
    private Set<String> roleNames;

    public UpdateUserRolesRequest() {
    }

    public UpdateUserRolesRequest(Set<String> roleNames) {
        this.roleNames = roleNames;
    }

    public Set<String> getRoleNames() {
        return roleNames;
    }

    public void setRoleNames(Set<String> roleNames) {
        this.roleNames = roleNames;
    }
}
