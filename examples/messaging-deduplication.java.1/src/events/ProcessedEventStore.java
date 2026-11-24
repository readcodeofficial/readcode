package com.shopwave.inventory.events;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class ProcessedEventStore {

    private final JdbcTemplate jdbc;

    public ProcessedEventStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Records the event for the given consumer group. Returns false when the event had already
     * been recorded, which the primary key (event_id, consumer) guarantees even across instances.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean markProcessed(UUID eventId, String consumer) {
        int inserted = jdbc.update(
                "INSERT INTO processed_events (event_id, consumer, processed_at) VALUES (?, ?, now()) "
                        + "ON CONFLICT (event_id, consumer) DO NOTHING",
                eventId, consumer);
        return inserted == 1;
    }
}
