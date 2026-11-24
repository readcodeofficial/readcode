package io.sensorgrid.replication;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

public final class QuorumReplicator {

    public static final class QuorumNotReachedException extends RuntimeException {
        public QuorumNotReachedException(long sequence, int quorum) {
            super("entry " + sequence + " did not reach " + quorum + " replicas");
        }
    }

    public static final class NotLeaderException extends RuntimeException {
        public NotLeaderException(long observedTerm) {
            super("a replica reported newer term " + observedTerm);
        }
    }

    private final ReplicaClient client;
    private final List<String> replicas;
    private final Duration replicaTimeout;
    private final long term;
    private final AtomicLong sequence = new AtomicLong();
    private final AtomicBoolean leader = new AtomicBoolean(true);

    public QuorumReplicator(ReplicaClient client, List<String> replicas, long term, Duration replicaTimeout) {
        if (replicas.isEmpty()) {
            throw new IllegalArgumentException("at least one replica is required");
        }
        this.client = client;
        this.replicas = List.copyOf(replicas);
        this.term = term;
        this.replicaTimeout = replicaTimeout;
    }

    int quorumSize() {
        return (replicas.size() + 1) / 2;
    }

    public boolean isLeader() {
        return leader.get();
    }

    public CompletableFuture<Long> replicate(String deviceId, long capturedAtMillis, byte[] payload) {
        if (!leader.get()) {
            return CompletableFuture.failedFuture(new NotLeaderException(term));
        }

        ReplicaClient.Entry entry = new ReplicaClient.Entry(
                sequence.incrementAndGet(), deviceId, capturedAtMillis, payload);
        int quorum = quorumSize();
        int tolerated = replicas.size() - quorum;

        CompletableFuture<Long> result = new CompletableFuture<>();
        AtomicInteger acks = new AtomicInteger();
        AtomicInteger failures = new AtomicInteger();

        Runnable recordFailure = () -> {
            if (failures.incrementAndGet() > tolerated) {
                result.completeExceptionally(new QuorumNotReachedException(entry.sequence(), quorum));
            }
        };

        for (String replica : replicas) {
            client.append(replica, term, entry)
                    .orTimeout(replicaTimeout.toMillis(), TimeUnit.MILLISECONDS)
                    .whenComplete((response, error) -> {
                        if (error != null) {
                            recordFailure.run();
                        } else if (response.accepted()) {
                            if (acks.incrementAndGet() >= quorum) {
                                result.complete(entry.sequence());
                            }
                        } else if (response.term() > term) {
                            leader.set(false);
                            result.completeExceptionally(new NotLeaderException(response.term()));
                        } else {
                            recordFailure.run();
                        }
                    });
        }
        return result;
    }
}
