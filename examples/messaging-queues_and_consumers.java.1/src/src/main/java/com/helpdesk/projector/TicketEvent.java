package com.helpdesk.projector;

import java.time.Instant;

public record TicketEvent(String ticketId, String type, String status, long version, Instant occurredAt) {
}
