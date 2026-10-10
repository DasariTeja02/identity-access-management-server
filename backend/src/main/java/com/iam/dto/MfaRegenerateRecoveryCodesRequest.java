package com.iam.dto;

public class MfaRegenerateRecoveryCodesRequest {

    private String password;
    private String code;

    public MfaRegenerateRecoveryCodesRequest() {
    }

    public MfaRegenerateRecoveryCodesRequest(String password, String code) {
        this.password = password;
        this.code = code;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }
}
