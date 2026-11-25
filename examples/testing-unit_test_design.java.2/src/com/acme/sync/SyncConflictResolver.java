package com.acme.sync;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

public final class SyncConflictResolver {

    public enum Resolution { IDENTICAL, KEEP_LOCAL, TAKE_REMOTE, KEEP_BOTH }

    public record FileVersion(String contentHash, long revision, long baseRevision,
                              Instant modifiedAt, boolean deleted) {}

    public static final class SuspectTimestampException extends RuntimeException {
        public SuspectTimestampException(String message) {
            super(message);
        }
    }

    private final Clock clock;
    private final Duration skewTolerance;

    public SyncConflictResolver(Clock clock, Duration skewTolerance) {
        this.clock = clock;
        this.skewTolerance = skewTolerance;
    }

    public Resolution resolve(FileVersion local, FileVersion remote) {
        rejectFutureTimestamp(local);
        rejectFutureTimestamp(remote);

        if (local.deleted() == remote.deleted() && Objects.equals(local.contentHash(), remote.contentHash())) {
            return Resolution.IDENTICAL;
        }
        if (remote.baseRevision() == local.revision()) {
            return Resolution.TAKE_REMOTE;
        }
        if (local.baseRevision() == remote.revision()) {
            return Resolution.KEEP_LOCAL;
        }
        if (local.deleted()) {
            return Resolution.TAKE_REMOTE;
        }
        if (remote.deleted()) {
            return Resolution.KEEP_LOCAL;
        }
        return Resolution.KEEP_BOTH;
    }

    private void rejectFutureTimestamp(FileVersion version) {
        Instant latestAcceptable = clock.instant().plus(skewTolerance);
        if (version.modifiedAt().isAfter(latestAcceptable)) {
            throw new SuspectTimestampException("modifiedAt " + version.modifiedAt() + " is beyond " + latestAcceptable);
        }
    }
}
