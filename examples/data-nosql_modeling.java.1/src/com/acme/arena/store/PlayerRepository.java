package com.acme.arena.store;

import static com.acme.arena.store.GameTable.NAME;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.Put;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.TransactWriteItem;
import software.amazon.awssdk.services.dynamodb.model.TransactWriteItemsRequest;
import software.amazon.awssdk.services.dynamodb.model.TransactionCanceledException;
import software.amazon.awssdk.services.dynamodb.model.Update;

public class PlayerRepository {

    public record MatchResult(String matchId, long playedAtMillis, String mapId, boolean won, int ratingDelta) {}

    public record LeaderboardEntry(String displayName, long rating) {}

    public enum RecordOutcome { RECORDED, DUPLICATE }

    public static class ConcurrentUpdateException extends RuntimeException {
        public ConcurrentUpdateException(String playerId) {
            super("rating of " + playerId + " kept changing");
        }
    }

    private static final int MAX_ATTEMPTS = 3;

    private final DynamoDbClient dynamo;

    public PlayerRepository(DynamoDbClient dynamo) {
        this.dynamo = dynamo;
    }

    private static AttributeValue n(long value) {
        return AttributeValue.fromN(Long.toString(value));
    }

    private static AttributeValue s(String value) {
        return AttributeValue.fromS(value);
    }

    private Map<String, AttributeValue> loadProfile(String playerId) {
        return dynamo.getItem(GetItemRequest.builder()
                        .tableName(NAME)
                        .key(GameTable.profileKey(playerId))
                        .consistentRead(true)
                        .build())
                .item();
    }

    public RecordOutcome recordMatch(String playerId, String season, MatchResult match) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            Map<String, AttributeValue> profile = loadProfile(playerId);
            long oldRating = Long.parseLong(profile.get("rating").n());
            long newRating = Math.max(0, oldRating + match.ratingDelta());

            Map<String, AttributeValue> matchItem = Map.of(
                    "pk", s(GameTable.playerPk(playerId)),
                    "sk", s(GameTable.matchSk(match.playedAtMillis(), match.matchId())),
                    "mapId", s(match.mapId()),
                    "won", AttributeValue.fromBool(match.won()),
                    "ratingDelta", n(match.ratingDelta()));

            Put putMatch = Put.builder()
                    .tableName(NAME)
                    .item(matchItem)
                    .conditionExpression("attribute_not_exists(pk)")
                    .build();
            Update updateProfile = Update.builder()
                    .tableName(NAME)
                    .key(GameTable.profileKey(playerId))
                    .updateExpression("SET rating = :new, gsi1pk = :shard, gsi1sk = :score ADD matchCount :one")
                    .conditionExpression("rating = :old")
                    .expressionAttributeValues(Map.of(
                            ":old", n(oldRating),
                            ":new", n(newRating),
                            ":shard", s(GameTable.leaderboardShard(season, playerId)),
                            ":score", s(Long.toString(newRating)),
                            ":one", n(1)))
                    .build();
            try {
                dynamo.transactWriteItems(TransactWriteItemsRequest.builder()
                        .transactItems(
                                TransactWriteItem.builder().put(putMatch).build(),
                                TransactWriteItem.builder().update(updateProfile).build())
                        .build());
                return RecordOutcome.RECORDED;
            } catch (TransactionCanceledException e) {
                if ("ConditionalCheckFailed".equals(e.cancellationReasons().get(0).code())) {
                    return RecordOutcome.DUPLICATE;
                }
            }
        }
        throw new ConcurrentUpdateException(playerId);
    }

    public List<Map<String, AttributeValue>> recentMatches(String playerId, int limit) {
        return dynamo.query(QueryRequest.builder()
                        .tableName(NAME)
                        .keyConditionExpression("pk = :pk AND begins_with(sk, :prefix)")
                        .expressionAttributeValues(Map.of(":pk", s(GameTable.playerPk(playerId)), ":prefix", s("MATCH#")))
                        .scanIndexForward(false)
                        .limit(limit)
                        .build())
                .items();
    }

    public List<LeaderboardEntry> topPlayers(String season, int n) {
        List<LeaderboardEntry> candidates = new ArrayList<>();
        for (int shard = 0; shard < GameTable.LEADERBOARD_SHARDS; shard++) {
            var response = dynamo.query(QueryRequest.builder()
                    .tableName(NAME)
                    .indexName(GameTable.LEADERBOARD_INDEX)
                    .keyConditionExpression("gsi1pk = :pk")
                    .expressionAttributeValues(Map.of(":pk", s("LB#" + season + "#" + shard)))
                    .scanIndexForward(false)
                    .limit(n)
                    .build());
            for (Map<String, AttributeValue> item : response.items()) {
                candidates.add(new LeaderboardEntry(item.get("displayName").s(), Long.parseLong(item.get("rating").n())));
            }
        }
        candidates.sort(Comparator.comparingLong(LeaderboardEntry::rating).reversed());
        return candidates.subList(0, Math.min(n, candidates.size()));
    }
}
