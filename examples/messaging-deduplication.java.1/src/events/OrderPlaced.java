package com.shopwave.inventory.events;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderPlaced(UUID eventId, UUID orderId, Instant placedAt, List<Line> lines) {

    public record Line(String sku, int quantity) {}
}
