package io.fleetpulse.status;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public class StatusCache {

    private final Map<String, DeviceStatus> latest = new ConcurrentHashMap<>();
    private final Duration maxStaleness;
    private final Clock clock;

    public StatusCache(Duration maxStaleness, Clock clock) {
        this.maxStaleness = maxStaleness;
        this.clock = clock;
    }

    public void put(DeviceStatus status) {
        latest.merge(status.deviceId(), status,
                (old, fresh) -> fresh.observedAt().isAfter(old.observedAt()) ? fresh : old);
    }

    public Optional<DeviceStatus> getUsable(String deviceId) {
        DeviceStatus cached = latest.get(deviceId);
        if (cached == null) {
            return Optional.empty();
        }
        Duration age = Duration.between(cached.observedAt(), clock.instant());
        return age.compareTo(maxStaleness) <= 0 ? Optional.of(cached) : Optional.empty();
    }
}
