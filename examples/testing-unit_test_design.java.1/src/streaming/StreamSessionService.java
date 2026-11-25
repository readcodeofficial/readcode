package streaming;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

public class StreamSessionService {

    static final Duration HEARTBEAT_TIMEOUT = Duration.ofMinutes(2);

    private final StreamSessionStore store;
    private final PlanCatalog plans;
    private final Clock clock;
    private final Supplier<String> ids;

    public StreamSessionService(StreamSessionStore store, PlanCatalog plans, Clock clock, Supplier<String> ids) {
        this.store = store;
        this.plans = plans;
        this.clock = clock;
        this.ids = ids;
    }

    public StreamSession start(String userId, String titleId, String deviceId) {
        Plan plan = plans.planFor(userId);
        Instant cutoff = clock.instant().minus(HEARTBEAT_TIMEOUT);
        List<StreamSession> live = store.findByUser(userId).stream()
                .filter(s -> s.lastHeartbeat().isAfter(cutoff))
                .toList();

        Optional<StreamSession> resumable = live.stream()
                .filter(s -> s.deviceId().equals(deviceId) && s.titleId().equals(titleId))
                .findFirst();
        if (resumable.isPresent()) {
            return resumable.get();
        }
        if (live.size() >= plan.maxStreams()) {
            throw new ConcurrentStreamLimitException(userId, plan.maxStreams());
        }

        StreamSession session = new StreamSession(ids.get(), userId, titleId, deviceId, clock.instant());
        store.insert(session);
        return session;
    }

    public void heartbeat(String sessionId) {
        StreamSession session = store.find(sessionId)
                .orElseThrow(() -> new UnknownSessionException(sessionId));
        store.save(session.withHeartbeat(clock.instant()));
    }
}

record StreamSession(String id, String userId, String titleId, String deviceId, Instant lastHeartbeat) {
    StreamSession withHeartbeat(Instant at) {
        return new StreamSession(id, userId, titleId, deviceId, at);
    }
}

record Plan(String name, int maxStreams) {}

interface StreamSessionStore {
    List<StreamSession> findByUser(String userId);

    Optional<StreamSession> find(String sessionId);

    void insert(StreamSession session);

    void save(StreamSession session);
}

interface PlanCatalog {
    Plan planFor(String userId);
}

class ConcurrentStreamLimitException extends RuntimeException {
    ConcurrentStreamLimitException(String userId, int limit) {
        super("user " + userId + " reached the limit of " + limit + " streams");
    }
}

class UnknownSessionException extends RuntimeException {
    UnknownSessionException(String sessionId) {
        super("no session " + sessionId);
    }
}
