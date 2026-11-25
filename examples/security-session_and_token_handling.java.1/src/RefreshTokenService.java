package com.helpdesk.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

interface RefreshTokenStore {
    RefreshRecord findByHash(String tokenHash);
    void insert(RefreshRecord record);
    boolean markUsed(UUID id, Instant at);
    void revokeFamily(UUID familyId);
}

record RefreshRecord(UUID id, UUID familyId, String agentId, List<String> roles,
                     String tokenHash, Instant expiresAt, boolean revoked) {}

record TokenPair(String accessToken, String refreshToken) {}

@Service
public class RefreshTokenService {

    private static final Duration REFRESH_TTL = Duration.ofDays(14);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenStore store;
    private final AccessTokenService accessTokens;
    private final Clock clock;

    RefreshTokenService(RefreshTokenStore store, AccessTokenService accessTokens, Clock clock) {
        this.store = store;
        this.accessTokens = accessTokens;
        this.clock = clock;
    }

    @Transactional
    public TokenPair startSession(String agentId, List<String> roles) {
        return issueInFamily(UUID.randomUUID(), agentId, roles);
    }

    @Transactional(noRollbackFor = InvalidTokenException.class)
    public TokenPair rotate(String presented) throws InvalidTokenException {
        RefreshRecord record = store.findByHash(hash(presented));
        if (record == null) {
            throw new InvalidTokenException("unknown refresh token");
        }
        if (record.revoked() || !record.expiresAt().isAfter(clock.instant())) {
            throw new InvalidTokenException("refresh token expired or revoked");
        }
        if (!store.markUsed(record.id(), clock.instant())) {
            store.revokeFamily(record.familyId());
            throw new InvalidTokenException("refresh token reuse detected");
        }
        return issueInFamily(record.familyId(), record.agentId(), record.roles());
    }

    @Transactional
    public void endSession(String presented) {
        RefreshRecord record = store.findByHash(hash(presented));
        if (record != null) {
            store.revokeFamily(record.familyId());
        }
    }

    private TokenPair issueInFamily(UUID familyId, String agentId, List<String> roles) {
        byte[] raw = new byte[32];
        RANDOM.nextBytes(raw);
        String refresh = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        store.insert(new RefreshRecord(UUID.randomUUID(), familyId, agentId, roles,
                hash(refresh), clock.instant().plus(REFRESH_TTL), false));
        return new TokenPair(accessTokens.issue(agentId, roles), refresh);
    }

    private static String hash(String token) {
        try {
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha256.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
