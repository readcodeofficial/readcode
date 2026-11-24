package com.acme.identity.auth;

import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    public record UserAccount(String id, String realm, boolean disabled) {}

    public static class DirectoryException extends Exception {
        public DirectoryException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public interface UserDirectory {
        Optional<UserAccount> findBySubject(String realm, String subject) throws DirectoryException;
    }

    private final TokenVerifier verifier;
    private final UserDirectory directory;

    public AuthService(TokenVerifier verifier, UserDirectory directory) {
        this.verifier = verifier;
        this.directory = directory;
    }

    public UserAccount authenticate(String bearerToken) throws AuthException {
        TokenVerifier.Claims claims;
        try {
            claims = verifier.verify(bearerToken);
        } catch (TokenVerifier.TokenParseException e) {
            throw new AuthException(AuthException.Code.INVALID_TOKEN, "token rejected: " + e.getMessage());
        }

        UserAccount account;
        try {
            account = directory
                    .findBySubject(claims.realm(), claims.subject())
                    .orElseThrow(() -> new AuthException(
                            AuthException.Code.INVALID_TOKEN, "no account for subject " + claims.subject()));
        } catch (DirectoryException e) {
            throw new AuthException(
                    AuthException.Code.DIRECTORY_UNAVAILABLE,
                    "directory lookup failed for realm " + claims.realm(),
                    e);
        } catch (RuntimeException e) {
            throw new AuthException(AuthException.Code.INTERNAL, "unexpected directory failure", e);
        }

        if (account.disabled()) {
            throw new AuthException(AuthException.Code.ACCOUNT_DISABLED, "account " + account.id() + " is disabled");
        }
        return account;
    }

    public int handle(String authorizationHeader) {
        try {
            if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
                return 401;
            }
            authenticate(authorizationHeader.substring("Bearer ".length()));
            return 200;
        } catch (AuthException e) {
            if (e.code().httpStatus() >= 500) {
                log.error("authentication failed code={}", e.code(), e);
            } else {
                log.info("authentication rejected code={} reason={}", e.code(), e.getMessage());
            }
            return e.code().httpStatus();
        }
    }
}
