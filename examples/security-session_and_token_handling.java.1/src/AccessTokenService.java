package com.helpdesk.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AccessTokenService {

    private static final String ISSUER = "helpdesk-auth";
    private static final String AUDIENCE = "helpdesk-api";
    private static final Duration ACCESS_TTL = Duration.ofMinutes(15);

    private final SecretKey key;
    private final Clock clock;

    public AccessTokenService(@Value("${helpdesk.auth.signing-secret}") String secret, Clock clock) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("helpdesk.auth.signing-secret must be at least 32 bytes");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.clock = clock;
    }

    public String issue(String agentId, List<String> roles) {
        Instant now = clock.instant();
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .issuer(ISSUER)
                .audience().add(AUDIENCE).and()
                .subject(agentId)
                .claim("roles", roles)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ACCESS_TTL)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public Claims verify(String token) throws InvalidTokenException {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(ISSUER)
                    .requireAudience(AUDIENCE)
                    .clock(() -> Date.from(clock.instant()))
                    .clockSkewSeconds(30)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidTokenException("invalid access token");
        }
    }
}

class InvalidTokenException extends RuntimeException {
    InvalidTokenException(String message) {
        super(message);
    }
}
