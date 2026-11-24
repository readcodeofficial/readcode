package com.sensorgrid.ingest;

import java.time.Instant;
import java.util.Optional;

record Reading(String deviceId, double value, Instant recordedAt) {}

record DeviceProfile(String deviceId, double maxThreshold) {}

record Alert(String deviceId, double value, double threshold, Instant recordedAt) {}

enum IngestResult { STORED, ALERTED, STALE, UNKNOWN_DEVICE, REJECTED_FUTURE }

interface DeviceRegistry {
    Optional<DeviceProfile> find(String deviceId);
}

interface ReadingStore {
    boolean saveIfNewer(Reading reading);

    Optional<Reading> latest(String deviceId);
}

interface AlertPublisher {
    void publish(Alert alert);
}
