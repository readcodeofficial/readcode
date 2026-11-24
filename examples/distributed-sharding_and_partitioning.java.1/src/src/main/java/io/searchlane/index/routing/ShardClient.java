package io.searchlane.index.routing;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

public interface ShardClient {

    record Document(String tenantId, String docId, String body, long version) {}

    record Hit(String docId, String tenantId, double score) {}

    CompletableFuture<Void> index(Document document);

    CompletableFuture<Optional<Document>> get(String tenantId, String docId);

    CompletableFuture<Void> delete(String tenantId, String docId);

    CompletableFuture<List<Hit>> search(String tenantId, String query, int limit);
}
