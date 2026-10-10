package com.iam.dto;

import jakarta.validation.constraints.NotNull;

public class UpdateUserStatusRequest {

    @NotNull(message = "Enabled flag must be provided")
    private Boolean enabled;

    public UpdateUserStatusRequest() {
    }

    public UpdateUserStatusRequest(Boolean enabled) {
        this.enabled = enabled;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }
}
