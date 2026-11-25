package com.acme.support.tickets;

import java.time.Instant;

public record Ticket(
        long id,
        String customerId,
        Priority priority,
        Channel channel,
        long attachmentBytes,
        Instant createdAt,
        Instant firstResponseAt,
        boolean closed) {
}
