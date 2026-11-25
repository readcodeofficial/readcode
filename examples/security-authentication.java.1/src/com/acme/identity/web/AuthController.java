package com.acme.identity.web;

import com.acme.identity.account.Account;
import com.acme.identity.account.AccountRepository;
import com.acme.identity.account.AccountStatus;
import java.time.Clock;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

interface AccessTokenIssuer {
    String issue(Authentication authentication);
}

record Credentials(String email, String password) {}

record VerifyRequest(String accountId, String code) {}

@RestController
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthenticationManager authenticationManager;
    private final AccessTokenIssuer tokens;
    private final AccountRepository accounts;
    private final PasswordEncoder encoder;
    private final VerificationCodes verificationCodes;
    private final Clock clock;

    public AuthController(AuthenticationManager authenticationManager, AccessTokenIssuer tokens,
                          AccountRepository accounts, PasswordEncoder encoder,
                          VerificationCodes verificationCodes, Clock clock) {
        this.authenticationManager = authenticationManager;
        this.tokens = tokens;
        this.accounts = accounts;
        this.encoder = encoder;
        this.verificationCodes = verificationCodes;
        this.clock = clock;
    }

    @PostMapping("/auth/register")
    public ResponseEntity<Map<String, String>> register(@RequestBody Credentials body) {
        String email = body.email().trim().toLowerCase(Locale.ROOT);
        if (accounts.findByEmail(email).isPresent()) {
            return ResponseEntity.accepted().body(Map.of("status", "verification_sent"));
        }
        Account account = new Account(UUID.randomUUID(), email, encoder.encode(body.password()),
                AccountStatus.PENDING_VERIFICATION, Set.of("ROLE_USER"));
        accounts.save(account);
        verificationCodes.send(account);
        return ResponseEntity.accepted().body(Map.of("status", "verification_sent"));
    }

    @PostMapping("/auth/verify")
    public ResponseEntity<Map<String, String>> verify(@RequestBody VerifyRequest body) {
        Account account = accounts.findById(UUID.fromString(body.accountId())).orElse(null);
        if (account == null || !verificationCodes.matches(account, body.code())) {
            return ResponseEntity.status(400).body(Map.of("error", "invalid_code"));
        }
        account.markVerified(clock.instant());
        accounts.save(account);
        return ResponseEntity.ok(Map.of("status", "verified"));
    }

    @PostMapping("/auth/login")
    public ResponseEntity<Map<String, String>> login(@RequestBody Credentials body) {
        String email = body.email().trim().toLowerCase(Locale.ROOT);
        try {
            Authentication result = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(email, body.password()));
            return ResponseEntity.ok(Map.of("access_token", tokens.issue(result)));
        } catch (AuthenticationException e) {
            log.info("login rejected: {}", e.getClass().getSimpleName());
            return ResponseEntity.status(401).body(Map.of("error", "invalid_credentials"));
        }
    }
}

interface VerificationCodes {
    void send(Account account);

    boolean matches(Account account, String code);
}
