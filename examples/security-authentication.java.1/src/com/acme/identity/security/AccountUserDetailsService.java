package com.acme.identity.security;

import com.acme.identity.account.Account;
import com.acme.identity.account.AccountRepository;
import com.acme.identity.account.AccountStatus;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsPasswordService;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class AccountUserDetailsService implements UserDetailsService, UserDetailsPasswordService {

    private final AccountRepository accounts;

    public AccountUserDetailsService(AccountRepository accounts) {
        this.accounts = accounts;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        Account account = accounts.findByEmail(email.toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new UsernameNotFoundException("no account for login"));
        return User.withUsername(account.getId().toString())
                .password(account.getPasswordHash())
                .authorities(account.getRoles().stream().map(SimpleGrantedAuthority::new).toList())
                .accountLocked(account.getStatus() == AccountStatus.SUSPENDED)
                .disabled(account.getStatus() == AccountStatus.CLOSED)
                .build();
    }

    @Override
    public UserDetails updatePassword(UserDetails user, String newEncodedPassword) {
        accounts.updatePasswordHash(UUID.fromString(user.getUsername()), newEncodedPassword);
        return User.withUserDetails(user).password(newEncodedPassword).build();
    }
}
