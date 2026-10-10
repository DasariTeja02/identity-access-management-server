package com.iam.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Production-hardened OpenAPI 3.0 specification configuration.
 * Configures JWT Bearer and Session authentication schemes.
 */
@Configuration
public class OpenApiConfig {

    @Value("${server.port:8080}")
    private String serverPort;

    @Bean
    public OpenAPI customOpenAPI() {
        final String bearerAuth = "BearerAuth";
        final String sessionAuth = "SessionAuth";

        return new OpenAPI()
                .info(new Info()
                        .title("Enterprise Identity & Access Management (IAM) API")
                        .version("1.0.0")
                        .description("Centralized OAuth 2.0, OpenID Connect 1.0, RBAC, Session Management, " +
                                "Multi-Factor Authentication (TOTP), and Administrative Governance Platform.")
                        .contact(new Contact()
                                .name("IAM Security Engineering")
                                .email("security@iam.local"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")))
                .servers(List.of(
                        new Server().url("/").description("Current Server Context"),
                        new Server().url("http://localhost:" + serverPort).description("Local Development")
                ))
                .components(new Components()
                        .addSecuritySchemes(bearerAuth, new SecurityScheme()
                                .name(bearerAuth)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("OAuth 2.0 JWT Access Token obtained via /oauth2/token or login"))
                        .addSecuritySchemes(sessionAuth, new SecurityScheme()
                                .name("X-Session-Id")
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.HEADER)
                                .description("Authenticated session token header")))
                .addSecurityItem(new SecurityRequirement().addList(bearerAuth).addList(sessionAuth));
    }
}
