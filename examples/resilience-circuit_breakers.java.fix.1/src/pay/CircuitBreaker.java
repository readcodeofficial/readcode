package pay;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

public final class CircuitBreaker {
    public enum State { CLOSED, OPEN, HALF_OPEN }

    private final int failureThreshold;
    private final Duration openFor;
    private final Clock clock;

    private State state = State.CLOSED;
    private int consecutiveFailures;
    private boolean probeInFlight;
    private Instant openedAt;

    public CircuitBreaker(int failureThreshold, Duration openFor, Clock clock) {
        this.failureThreshold = failureThreshold;
        this.openFor = openFor;
        this.clock = clock;
    }

    public synchronized State state() {
        return state;
    }

    /** True if the caller may go ahead and call the protected dependency. */
    public synchronized boolean tryAcquire() {
        switch (state) {
            case CLOSED:
                return true;
            case OPEN:
                if (clock.instant().isBefore(openedAt.plus(openFor))) {
                    return false;
                }
                state = State.HALF_OPEN;
                probeInFlight = true;
                return true;
            default:
                if (probeInFlight) {
                    return false;
                }
                probeInFlight = true;
                return true;
        }
    }

    public synchronized void recordSuccess() {
        state = State.CLOSED;
        probeInFlight = false;
    }

    public synchronized void recordFailure() {
        probeInFlight = false;
        consecutiveFailures++;
        if (state == State.HALF_OPEN || consecutiveFailures >= failureThreshold) {
            state = State.OPEN;
            openedAt = clock.instant();
        }
    }
}
