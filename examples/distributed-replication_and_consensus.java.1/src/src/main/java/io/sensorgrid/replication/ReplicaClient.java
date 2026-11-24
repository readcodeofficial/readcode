package io.sensorgrid.replication;

import java.util.concurrent.CompletableFuture;

public interface ReplicaClient {

    record Entry(long sequence, String deviceId, long capturedAtMillis, byte[] payload) {}

    record Response(boolean accepted, long term) {}

    CompletableFuture<Response> append(String replicaId, long term, Entry entry);
}
