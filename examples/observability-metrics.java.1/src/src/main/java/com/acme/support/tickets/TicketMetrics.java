package com.acme.support.tickets;

import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class TicketMetrics {

    private final MeterRegistry registry;
    private final Map<Priority, AtomicInteger> openByPriority = new EnumMap<>(Priority.class);

    public TicketMetrics(MeterRegistry registry, TicketRepository repository) {
        this.registry = registry;
        for (Priority priority : Priority.values()) {
            AtomicInteger open = registry.gauge(
                    "support.tickets.open",
                    Tags.of("priority", tag(priority)),
                    new AtomicInteger(repository.countOpen(priority)));
            openByPriority.put(priority, open);
        }
    }

    public Timer.Sample startSave() {
        return Timer.start(registry);
    }

    public void stopSave(Timer.Sample sample, String outcome) {
        sample.stop(registry.timer("support.tickets.save.duration", "outcome", outcome));
    }

    public void ticketCreated(Ticket ticket) {
        registry.counter(
                        "support.tickets.created",
                        "priority", tag(ticket.priority()),
                        "channel", tag(ticket.channel()))
                .increment();
        openByPriority.get(ticket.priority()).incrementAndGet();
        DistributionSummary.builder("support.tickets.attachment.size")
                .baseUnit("bytes")
                .register(registry)
                .record(ticket.attachmentBytes());
    }

    public void firstResponse(Ticket ticket, Instant respondedAt) {
        Duration elapsed = Duration.between(ticket.createdAt(), respondedAt);
        Timer.builder("support.tickets.first_response")
                .tag("priority", tag(ticket.priority()))
                .serviceLevelObjectives(Duration.ofMinutes(15), Duration.ofHours(1), Duration.ofHours(4))
                .register(registry)
                .record(elapsed);
        if (elapsed.compareTo(ticket.priority().firstResponseSla()) > 0) {
            registry.counter(
                            "support.tickets.sla.breaches",
                            "priority", tag(ticket.priority()),
                            "sla", "first_response")
                    .increment();
        }
    }

    public void ticketClosed(Ticket ticket) {
        openByPriority.get(ticket.priority()).decrementAndGet();
    }

    private static String tag(Enum<?> value) {
        return value.name().toLowerCase(Locale.ROOT);
    }
}
