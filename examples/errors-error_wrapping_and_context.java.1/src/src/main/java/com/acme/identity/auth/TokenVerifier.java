package com.acme.identity.auth;

import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

public class TokenVerifier {

    public static class TokenParseException extends Exception {
        public TokenParseException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    public record Claims(String subject, String realm, Instant expiresAt) {}

    private final Map<String, byte[]> signingKeys;
    private final Clock clock;
    private final SignatureChecker checker;

    public interface SignatureChecker {
        boolean matches(byte[] key, String signedPart, byte[] signature) throws java.security.GeneralSecurityException;
    }

    public TokenVerifier(Map<String, byte[]> signingKeys, Clock clock, SignatureChecker checker) {
        this.signingKeys = signingKeys;
        this.clock = clock;
        this.checker = checker;
    }

    public Claims verify(String token) throws TokenParseException {
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new TokenParseException("expected 3 segments but got " + parts.length, null);
        }
        try {
            String[] header = new String(Base64.getUrlDecoder().decode(parts[0])).split(":", 2);
            byte[] key = signingKeys.get(header[0]);
            if (key == null) {
                throw new TokenParseException("unknown key id " + header[0], null);
            }
            byte[] signature = Base64.getUrlDecoder().decode(parts[2]);
            if (!checker.matches(key, parts[0] + "." + parts[1], signature)) {
                throw new TokenParseException("signature mismatch", null);
            }
            String[] body = new String(Base64.getUrlDecoder().decode(parts[1])).split("\\|");
            Instant expiresAt = Instant.ofEpochSecond(Long.parseLong(body[2]));
            if (expiresAt.isBefore(clock.instant())) {
                throw new TokenParseException("token expired at " + expiresAt, null);
            }
            return new Claims(body[0], body[1], expiresAt);
        } catch (IllegalArgumentException | ArrayIndexOutOfBoundsException e) {
            throw new TokenParseException("malformed token body", e);
        } catch (java.security.GeneralSecurityException e) {
            throw new TokenParseException("signature check failed", e);
        }
    }
}
