package com.acme.sync;

import static com.acme.sync.SyncConflictResolver.Resolution.IDENTICAL;
import static com.acme.sync.SyncConflictResolver.Resolution.KEEP_BOTH;
import static com.acme.sync.SyncConflictResolver.Resolution.KEEP_LOCAL;
import static com.acme.sync.SyncConflictResolver.Resolution.TAKE_REMOTE;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.acme.sync.SyncConflictResolver.FileVersion;
import com.acme.sync.SyncConflictResolver.Resolution;
import com.acme.sync.SyncConflictResolver.SuspectTimestampException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class SyncConflictResolverTest {

    private static final Instant NOW = Instant.parse("2026-03-01T12:00:00Z");

    private final SyncConflictResolver resolver =
            new SyncConflictResolver(Clock.fixed(NOW, ZoneOffset.UTC), Duration.ofMinutes(5));

    private static FileVersion edit(String hash, long revision, long base) {
        return new FileVersion(hash, revision, base, NOW.minusSeconds(60), false);
    }

    private static FileVersion deletion(long revision, long base) {
        return new FileVersion(null, revision, base, NOW.minusSeconds(60), true);
    }

    private static FileVersion editedAt(Instant modifiedAt) {
        return new FileVersion("h1", 2, 1, modifiedAt, false);
    }

    static Stream<Arguments> cases() {
        return Stream.of(
                Arguments.of("same content on both sides", edit("h1", 4, 3), edit("h1", 5, 3), IDENTICAL),
                Arguments.of("remote built on local", edit("h1", 4, 3), edit("h2", 5, 4), TAKE_REMOTE),
                Arguments.of("local built on remote", edit("h2", 5, 4), edit("h1", 4, 3), KEEP_LOCAL),
                Arguments.of("diverged edits", edit("h2", 5, 4), edit("h3", 5, 4), KEEP_BOTH),
                Arguments.of("remote edit beats local delete", deletion(5, 4), edit("h3", 5, 4), TAKE_REMOTE),
                Arguments.of("local edit beats remote delete", edit("h2", 5, 4), deletion(5, 4), KEEP_LOCAL));
    }

    private static Resolution mirror(Resolution resolution) {
        return switch (resolution) {
            case KEEP_LOCAL -> TAKE_REMOTE;
            case TAKE_REMOTE -> KEEP_LOCAL;
            default -> resolution;
        };
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("cases")
    void resolvesEachScenario(String name, FileVersion local, FileVersion remote, Resolution expected) {
        assertEquals(expected, resolver.resolve(local, remote));
    }

    @ParameterizedTest(name = "{0}, sides swapped")
    @MethodSource("cases")
    void swappingSidesMirrorsTheOutcome(String name, FileVersion local, FileVersion remote, Resolution expected) {
        assertEquals(mirror(expected), resolver.resolve(remote, local));
    }

    @Test
    void clockSkewWithinToleranceIsAccepted() {
        FileVersion slightlyAhead = editedAt(NOW.plus(Duration.ofMinutes(4)));

        assertDoesNotThrow(() -> resolver.resolve(slightlyAhead, edit("h2", 3, 2)));
    }

    @Test
    void timestampBeyondToleranceIsRejected() {
        FileVersion farAhead = editedAt(NOW.plus(Duration.ofMinutes(6)));

        assertThrows(SuspectTimestampException.class, () -> resolver.resolve(edit("h2", 3, 2), farAhead));
    }
}
