package com.ridedispatch.tracking;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

public class SessionSequenceFilter {

    public enum Verdict { ACCEPTED, DUPLICATE, OUT_OF_ORDER, STALE_SESSION, TOO_OLD }

    private record Mark(String sessionId, Instant sessionStartedAt, long sequence) {
        static Mark of(LocationUpdate u) {
            return new Mark(u.sessionId(), u.sessionStartedAt(), u.sequence());
        }
    }

    private final Cache<String, Mark> marks;
    private final Clock clock;
    private final Duration maxAge;

    public SessionSequenceFilter(Clock clock, Duration maxAge, Duration idleEviction) {
        this.clock = clock;
        this.maxAge = maxAge;
        this.marks = Caffeine.newBuilder()
                .maximumSize(200_000)
                .expireAfterAccess(idleEviction)
                .build();
    }

    public Verdict check(LocationUpdate update) {
        if (update.recordedAt().isBefore(clock.instant().minus(maxAge))) {
            return Verdict.TOO_OLD;
        }

        AtomicReference<Verdict> verdict = new AtomicReference<>();
        marks.asMap().compute(update.driverId(), (driverId, mark) -> {
            if (mark == null) {
                verdict.set(Verdict.ACCEPTED);
                return Mark.of(update);
            }
            if (mark.sessionId().equals(update.sessionId())) {
                if (update.sequence() == mark.sequence()) {
                    verdict.set(Verdict.DUPLICATE);
                    return mark;
                }
                if (update.sequence() < mark.sequence()) {
                    verdict.set(Verdict.OUT_OF_ORDER);
                    return mark;
                }
                verdict.set(Verdict.ACCEPTED);
                return Mark.of(update);
            }
            if (update.sessionStartedAt().isAfter(mark.sessionStartedAt())) {
                verdict.set(Verdict.ACCEPTED);
                return Mark.of(update);
            }
            verdict.set(Verdict.STALE_SESSION);
            return mark;
        });
        return verdict.get();
    }

    public void forget(String driverId) {
        marks.invalidate(driverId);
    }
}
