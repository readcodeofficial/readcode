package com.helpdesk.projector;

import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TicketProjector {

    public interface TicketViewStore {
        Optional<Long> findVersion(String ticketId);

        void upsert(String ticketId, String status, long version);
    }

    private final TicketViewStore store;

    public TicketProjector(TicketViewStore store) {
        this.store = store;
    }

    @Transactional
    public void apply(TicketEvent event) {
        if (event.ticketId() == null || event.status() == null) {
            throw new IllegalArgumentException("incomplete ticket event: " + event);
        }
        long current = store.findVersion(event.ticketId()).orElse(0L);
        if (event.version() <= current) {
            return;
        }
        try {
            store.upsert(event.ticketId(), event.status(), event.version());
        } catch (org.springframework.dao.TransientDataAccessException ex) {
            throw new TransientProjectionException("read model unavailable", ex);
        }
    }
}
