package sessions;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class QuorumStore {
    private final List<Replica> replicas;
    private final int quorum;
    private long clock = 0;

    public QuorumStore(List<Replica> replicas) {
        if (replicas.isEmpty()) {
            throw new IllegalArgumentException("need at least one replica");
        }
        this.replicas = List.copyOf(replicas);
        this.quorum = replicas.size() / 2;
    }

    public int quorum() {
        return quorum;
    }

    public boolean put(String key, String value) {
        Versioned versioned = new Versioned(++clock, value);
        int acks = 0;
        for (Replica replica : replicas) {
            if (replica.write(key, versioned)) {
                acks++;
            }
        }
        return acks >= quorum;
    }

    public Optional<String> get(String key) {
        List<Optional<Versioned>> responses = new ArrayList<>();
        for (Replica replica : replicas) {
            replica.read(key).ifPresent(responses::add);
        }
        if (responses.size() < quorum) {
            throw new NoQuorumException("only " + responses.size() + " of " + replicas.size() + " replicas answered");
        }
        Versioned newest = null;
        for (Optional<Versioned> response : responses) {
            if (response.isPresent() && (newest == null || response.get().version() > newest.version())) {
                newest = response.get();
            }
        }
        return Optional.ofNullable(newest).map(Versioned::value);
    }
}
