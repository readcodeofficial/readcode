package com.sensorgrid.ingest;

import java.time.Clock;
import java.time.Duration;
import java.util.Optional;

public class TelemetryIngestService {

    static final Duration MAX_CLOCK_SKEW = Duration.ofMinutes(5);

    private final DeviceRegistry registry;
    private final ReadingStore store;
    private final AlertPublisher alerts;
    private final Clock clock;

    public TelemetryIngestService(DeviceRegistry registry, ReadingStore store, AlertPublisher alerts, Clock clock) {
        this.registry = registry;
        this.store = store;
        this.alerts = alerts;
        this.clock = clock;
    }

    public IngestResult ingest(Reading reading) {
        Optional<DeviceProfile> profile = registry.find(reading.deviceId());
        if (profile.isEmpty()) {
            return IngestResult.UNKNOWN_DEVICE;
        }
        if (reading.recordedAt().isAfter(clock.instant().plus(MAX_CLOCK_SKEW))) {
            return IngestResult.REJECTED_FUTURE;
        }
        if (!store.saveIfNewer(reading)) {
            return IngestResult.STALE;
        }
        double threshold = profile.get().maxThreshold();
        if (reading.value() > threshold) {
            alerts.publish(new Alert(reading.deviceId(), reading.value(), threshold, reading.recordedAt()));
            return IngestResult.ALERTED;
        }
        return IngestResult.STORED;
    }
}
