package com.streamly.watchhistory;

import java.time.Instant;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

record PlaybackEvent(String eventId, String profileId, String titleId, Type type, long positionSeconds, Instant occurredAt) {
    enum Type { PROGRESS, COMPLETED }
}

@Repository
class ProcessedEventStore {

    private final JdbcTemplate jdbc;

    ProcessedEventStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    boolean markIfNew(String eventId) {
        int inserted = jdbc.update(
                "INSERT INTO processed_events (event_id, processed_at) VALUES (?, now()) "
                        + "ON CONFLICT (event_id) DO NOTHING",
                eventId);
        return inserted == 1;
    }
}

@Repository
class WatchHistoryRepository {

    private final JdbcTemplate jdbc;

    WatchHistoryRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    void apply(PlaybackEvent event) throws DataAccessException {
        int completions = event.type() == PlaybackEvent.Type.COMPLETED ? 1 : 0;
        jdbc.update(
                "INSERT INTO watch_history (profile_id, title_id, position_seconds, completions, updated_at) "
                        + "VALUES (?, ?, ?, ?, ?) "
                        + "ON CONFLICT (profile_id, title_id) DO UPDATE SET "
                        + "position_seconds = GREATEST(watch_history.position_seconds, EXCLUDED.position_seconds), "
                        + "completions = watch_history.completions + EXCLUDED.completions, "
                        + "updated_at = GREATEST(watch_history.updated_at, EXCLUDED.updated_at)",
                event.profileId(), event.titleId(), event.positionSeconds(), completions,
                java.sql.Timestamp.from(event.occurredAt()));
    }
}
