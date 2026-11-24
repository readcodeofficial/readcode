package com.helpdesk.tickets;

import java.time.Instant;
import java.util.List;

public record Ticket(long id, String subject, String status, String assigneeId, Instant createdAt) {}

record TicketPage(List<Ticket> items, String nextCursor) {}

class InvalidCursorException extends RuntimeException {
    InvalidCursorException(String message, Throwable cause) {
        super(message, cause);
    }
}

class TicketStoreException extends RuntimeException {
    TicketStoreException(String message, Throwable cause) {
        super(message, cause);
    }
}
