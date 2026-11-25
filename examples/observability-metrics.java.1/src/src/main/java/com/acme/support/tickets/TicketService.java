package com.acme.support.tickets;

import java.time.Clock;
import java.time.Instant;

public class TicketService {

    private final TicketRepository repository;
    private final TicketMetrics metrics;
    private final Clock clock;

    public TicketService(TicketRepository repository, TicketMetrics metrics, Clock clock) {
        this.repository = repository;
        this.metrics = metrics;
        this.clock = clock;
    }

    public Ticket open(Priority priority, Channel channel, String customerId, long attachmentBytes) {
        var sample = metrics.startSave();
        String outcome = "success";
        Ticket saved;
        try {
            saved = repository.save(priority, channel, customerId, attachmentBytes);
        } catch (RuntimeException e) {
            outcome = "error";
            throw e;
        } finally {
            metrics.stopSave(sample, outcome);
        }
        metrics.ticketCreated(saved);
        return saved;
    }

    public void recordFirstResponse(long ticketId) {
        Ticket ticket = repository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("unknown ticket " + ticketId));
        Instant now = clock.instant();
        if (repository.markFirstResponse(ticketId, now)) {
            metrics.firstResponse(ticket, now);
        }
    }

    public void close(long ticketId) {
        Ticket ticket = repository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("unknown ticket " + ticketId));
        if (repository.close(ticketId)) {
            metrics.ticketClosed(ticket);
        }
    }
}
