package com.ridedispatch.tracking;

import java.time.Instant;

public record LocationUpdate(
        String driverId,
        String sessionId,
        Instant sessionStartedAt,
        long sequence,
        Instant recordedAt,
        double latitude,
        double longitude) {

    public LocationUpdate {
        if (driverId == null || driverId.isBlank() || sessionId == null || sessionStartedAt == null
                || recordedAt == null) {
            throw new IllegalArgumentException("incomplete location update");
        }
    }
}
