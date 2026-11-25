package com.acme.identity.account;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public class Account {
    private final UUID id;
    private final String email;
    private String passwordHash;
    private AccountStatus status;
    private final Set<String> roles;
    private Instant verifiedAt;

    public Account(UUID id, String email, String passwordHash, AccountStatus status, Set<String> roles) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
        this.status = status;
        this.roles = roles;
    }

    public UUID getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public AccountStatus getStatus() { return status; }
    public Set<String> getRoles() { return roles; }

    public void markVerified(Instant at) {
        this.status = AccountStatus.ACTIVE;
        this.verifiedAt = at;
    }
}
