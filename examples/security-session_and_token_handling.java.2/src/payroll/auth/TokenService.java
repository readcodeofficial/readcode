package payroll.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TokenService {

    private static final Duration ACCESS_TTL = Duration.ofMinutes(15);
    private static final Duration REFRESH_TTL = Duration.ofDays(14);

    private final RefreshTokenRepository tokens;
    private final EmployeeDirectory directory;
    private final SecretKey signingKey;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public TokenService(RefreshTokenRepository tokens, EmployeeDirectory directory,
                        SigningKeyProvider keys, Clock clock) {
        this.tokens = tokens;
        this.directory = directory;
        this.signingKey = Keys.hmacShaKeyFor(keys.currentSecret());
        this.clock = clock;
    }

    @Transactional
    public TokenPair login(String employeeId, String familyId) {
        return issue(employeeId, familyId == null ? UUID.randomUUID().toString() : familyId);
    }

    @Transactional
    public TokenPair refresh(String presentedToken) {
        Instant now = clock.instant();
        RefreshToken stored = tokens.findByTokenHash(sha256(presentedToken))
                .orElseThrow(() -> new InvalidTokenException("unknown refresh token"));

        if (stored.isRevoked() || stored.isExpired(now)) {
            throw new InvalidTokenException("refresh token no longer valid");
        }
        if (stored.isUsed()) {
            tokens.revokeFamily(stored.getFamilyId(), now);
            throw new TokenReuseException(stored.getFamilyId());
        }
        if (!directory.isActive(stored.getEmployeeId())) {
            throw new InvalidTokenException("employee is not active");
        }

        stored.markUsed(now);
        return issue(stored.getEmployeeId(), stored.getFamilyId());
    }

    private TokenPair issue(String employeeId, String familyId) {
        Instant now = clock.instant();
        String access = Jwts.builder()
                .subject(employeeId)
                .claim("roles", directory.rolesOf(employeeId))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ACCESS_TTL)))
                .signWith(signingKey)
                .compact();

        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String refresh = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        tokens.save(new RefreshToken(UUID.randomUUID().toString(), sha256(refresh), familyId,
                employeeId, now.plus(REFRESH_TTL)));
        return new TokenPair(access, refresh);
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
