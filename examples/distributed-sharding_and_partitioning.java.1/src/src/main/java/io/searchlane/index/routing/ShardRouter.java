package io.searchlane.index.routing;

import com.google.common.hash.HashFunction;
import com.google.common.hash.Hashing;
import java.nio.charset.StandardCharsets;

/** Maps a routing key to one of shardCount index shards using Guava's jump consistent hash. */
public final class ShardRouter {

    private static final HashFunction HASH = Hashing.murmur3_128();

    private final int shardCount;

    public ShardRouter(int shardCount) {
        if (shardCount <= 0) {
            throw new IllegalArgumentException("shardCount must be positive");
        }
        this.shardCount = shardCount;
    }

    public int shardFor(String routingKey) {
        return Hashing.consistentHash(HASH.hashString(routingKey, StandardCharsets.UTF_8), shardCount);
    }

    public int shardCount() {
        return shardCount;
    }
}
