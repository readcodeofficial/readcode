package com.acme.support.tickets;

import java.time.Instant;
import java.util.Optional;

public interface TicketRepository {
    Ticket save(Priority priority, Channel channel, String customerId, long attachmentBytes);

    Optional<Ticket> findById(long id);

    int countOpen(Priority priority);

    /** Sets first_response_at only if it is still null; returns whether this call changed the row. */
    boolean markFirstResponse(long id, Instant respondedAt);

    /** Closes the ticket if it is open; returns whether this call changed the row. */
    boolean close(long id);
}
