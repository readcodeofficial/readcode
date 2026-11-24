package io.fleetpulse.status;

import java.time.Instant;

public record DeviceStatus(
        String deviceId,
        double batteryPct,
        int signalDbm,
        Instant observedAt,
        boolean degraded) {

    public DeviceStatus asDegraded() {
        return new DeviceStatus(deviceId, batteryPct, signalDbm, observedAt, true);
    }
}
