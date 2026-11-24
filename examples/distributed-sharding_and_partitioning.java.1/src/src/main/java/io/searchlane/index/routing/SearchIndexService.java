package io.searchlane.index.routing;

import io.searchlane.index.routing.ShardClient.Document;
import io.searchlane.index.routing.ShardClient.Hit;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

public class SearchIndexService {

    public record SearchResult(List<Hit> hits, boolean partial) {}

    private static final Duration SHARD_TIMEOUT = Duration.ofMillis(800);

    private final ShardRouter router;
    private final List<ShardClient> shards;

    public SearchIndexService(ShardRouter router, List<ShardClient> shards) {
        if (router.shardCount() != shards.size()) {
            throw new IllegalStateException("router and shard client list disagree on shard count");
        }
        this.router = router;
        this.shards = List.copyOf(shards);
    }

    public CompletableFuture<Void> index(Document document) {
        return shards.get(router.shardFor(document.tenantId())).index(document);
    }

    public CompletableFuture<Optional<Document>> get(String tenantId, String docId) {
        return shards.get(router.shardFor(tenantId)).get(tenantId, docId);
    }

    public CompletableFuture<Void> delete(String tenantId, String docId) {
        return shards.get(router.shardFor(docId)).delete(tenantId, docId);
    }

    /** Tenant-scoped search touches exactly one shard because a tenant's documents are co-located. */
    public CompletableFuture<SearchResult> searchTenant(String tenantId, String query, int limit) {
        return shards.get(router.shardFor(tenantId))
                .search(tenantId, query, limit)
                .orTimeout(SHARD_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)
                .thenApply(hits -> new SearchResult(hits, false));
    }

    /** Operator search across all tenants: scatter to every shard, gather whatever answers in time. */
    public CompletableFuture<SearchResult> searchAll(String query, int limit) {
        List<CompletableFuture<List<Hit>>> calls = new ArrayList<>();
        boolean[] failed = new boolean[shards.size()];
        for (int i = 0; i < shards.size(); i++) {
            final int shard = i;
            calls.add(shards.get(shard)
                    .search("*", query, limit)
                    .orTimeout(SHARD_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)
                    .exceptionally(error -> {
                        failed[shard] = true;
                        return List.of();
                    }));
        }
        return CompletableFuture.allOf(calls.toArray(CompletableFuture[]::new)).thenApply(ignored -> {
            List<Hit> merged = calls.stream()
                    .flatMap(call -> call.join().stream())
                    .sorted(Comparator.comparingDouble(Hit::score).reversed())
                    .limit(limit)
                    .toList();
            boolean partial = false;
            for (boolean shardFailed : failed) {
                partial |= shardFailed;
            }
            return new SearchResult(merged, partial);
        });
    }
}
