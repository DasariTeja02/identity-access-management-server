package com.iam.security;

import com.iam.entity.Authority;
import com.iam.entity.Role;
import com.iam.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

public class CustomUserDetails implements UserDetails {

    private final User user;
    private final List<GrantedAuthority> authorities;

    public CustomUserDetails(User user) {
        this.user = user;
        this.authorities = new ArrayList<>();

        if (user.getRoles() != null) {
            for (Role role : user.getRoles()) {
                // Add role itself, ensuring ROLE_ prefix
                String roleName = role.getName().startsWith("ROLE_") ? role.getName() : "ROLE_" + role.getName();
                this.authorities.add(new SimpleGrantedAuthority(roleName));

                // Add authorities associated with this role
                if (role.getAuthorities() != null) {
                    for (Authority auth : role.getAuthorities()) {
                        this.authorities.add(new SimpleGrantedAuthority(auth.getName()));
                    }
                }
            }
        }
    }

    public User getUser() {
        return user;
    }

    public Long getId() {
        return user.getId();
    }

    public String getEmail() {
        return user.getEmail();
    }

    public String getFirstName() {
        return user.getFirstName();
    }

    public String getLastName() {
        return user.getLastName();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getUsername();
    }

    @Override
    public boolean isAccountNonExpired() {
        return user.isAccountNonExpired();
    }

    @Override
    public boolean isAccountNonLocked() {
        return user.isAccountNonLocked();
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return user.isCredentialsNonExpired();
    }

    @Override
    public boolean isEnabled() {
        return user.isEnabled();
    }
}
