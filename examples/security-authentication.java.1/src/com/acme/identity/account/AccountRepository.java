package com.acme.identity.account;

import java.util.Optional;
import java.util.UUID;

public interface AccountRepository {
    Optional<Account> findByEmail(String normalizedEmail);

    Optional<Account> findById(UUID id);

    void updatePasswordHash(UUID id, String encodedPassword);

    void save(Account account);
}
