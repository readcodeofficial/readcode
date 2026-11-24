package com.helpdesk.tickets;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

public record TicketCursor(Instant createdAt, long id) {

    public String encode() {
        String raw = createdAt.toEpochMilli() + ":" + id;
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    public static TicketCursor decode(String token) {
        try {
            String raw = new String(Base64.getUrlDecoder().decode(token), StandardCharsets.UTF_8);
            int sep = raw.indexOf(':');
            long millis = Long.parseLong(raw.substring(0, sep));
            long id = Long.parseLong(raw.substring(sep + 1));
            return new TicketCursor(Instant.ofEpochMilli(millis), id);
        } catch (IllegalArgumentException | StringIndexOutOfBoundsException e) {
            throw new InvalidCursorException("malformed cursor", e);
        }
    }
}
