package com.fleetbite.orders.health;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.actuate.health.Status;
import org.springframework.stereotype.Component;

import com.fleetbite.orders.kitchen.TicketRepository;

@Component("kitchenBacklog")
public class KitchenBacklogHealthIndicator implements HealthIndicator {

    public static final Status DEGRADED = new Status("DEGRADED");

    private final TicketRepository tickets;
    private final int degradedThreshold;

    public KitchenBacklogHealthIndicator(
            TicketRepository tickets,
            @Value("${fleetbite.health.backlog-threshold:500}") int degradedThreshold) {
        this.tickets = tickets;
        this.degradedThreshold = degradedThreshold;
    }

    @Override
    public Health health() {
        long open = tickets.countByStatusIn(java.util.List.of("QUEUED", "PREPARING"));
        Health.Builder builder = open >= degradedThreshold
                ? Health.status(DEGRADED)
                : Health.up();
        return builder.withDetail("openTickets", open)
                .withDetail("threshold", degradedThreshold)
                .build();
    }
}
