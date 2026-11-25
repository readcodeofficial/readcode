package com.acme.support.tickets;

import java.time.Duration;

public enum Priority {
    LOW(Duration.ofHours(24)),
    NORMAL(Duration.ofHours(8)),
    HIGH(Duration.ofHours(1)),
    URGENT(Duration.ofMinutes(15));

    private final Duration firstResponseSla;

    Priority(Duration firstResponseSla) {
        this.firstResponseSla = firstResponseSla;
    }

    public Duration firstResponseSla() {
        return firstResponseSla;
    }
}
