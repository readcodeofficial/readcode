package com.acme.arena.store;

import java.util.Map;
import software.amazon.awssdk.services.dynamodb.model.AttributeDefinition;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.BillingMode;
import software.amazon.awssdk.services.dynamodb.model.CreateTableRequest;
import software.amazon.awssdk.services.dynamodb.model.GlobalSecondaryIndex;
import software.amazon.awssdk.services.dynamodb.model.KeySchemaElement;
import software.amazon.awssdk.services.dynamodb.model.KeyType;
import software.amazon.awssdk.services.dynamodb.model.Projection;
import software.amazon.awssdk.services.dynamodb.model.ProjectionType;
import software.amazon.awssdk.services.dynamodb.model.ScalarAttributeType;

final class GameTable {
    static final String NAME = "arena_players";
    static final String LEADERBOARD_INDEX = "leaderboard";
    static final int LEADERBOARD_SHARDS = 8;

    private GameTable() {}

    static String playerPk(String playerId) {
        return "PLAYER#" + playerId;
    }

    static String matchSk(long playedAtMillis, String matchId) {
        return "MATCH#" + playedAtMillis + "#" + matchId;
    }

    static String leaderboardShard(String season, String playerId) {
        return "LB#" + season + "#" + Math.floorMod(playerId.hashCode(), LEADERBOARD_SHARDS);
    }

    static Map<String, AttributeValue> profileKey(String playerId) {
        return Map.of("pk", AttributeValue.fromS(playerPk(playerId)), "sk", AttributeValue.fromS("PROFILE"));
    }

    private static KeySchemaElement key(String name, KeyType type) {
        return KeySchemaElement.builder().attributeName(name).keyType(type).build();
    }

    private static AttributeDefinition attribute(String name, ScalarAttributeType type) {
        return AttributeDefinition.builder().attributeName(name).attributeType(type).build();
    }

    static CreateTableRequest createRequest() {
        return CreateTableRequest.builder()
                .tableName(NAME)
                .billingMode(BillingMode.PAY_PER_REQUEST)
                .attributeDefinitions(
                        attribute("pk", ScalarAttributeType.S),
                        attribute("sk", ScalarAttributeType.S),
                        attribute("gsi1pk", ScalarAttributeType.S),
                        AttributeDefinition.builder().attributeName("gsi1sk").attributeType(ScalarAttributeType.S).build())
                .keySchema(key("pk", KeyType.HASH), key("sk", KeyType.RANGE))
                .globalSecondaryIndexes(GlobalSecondaryIndex.builder()
                        .indexName(LEADERBOARD_INDEX)
                        .keySchema(key("gsi1pk", KeyType.HASH), key("gsi1sk", KeyType.RANGE))
                        .projection(Projection.builder()
                                .projectionType(ProjectionType.INCLUDE)
                                .nonKeyAttributes("displayName", "rating")
                                .build())
                        .build())
                .build();
    }
}
