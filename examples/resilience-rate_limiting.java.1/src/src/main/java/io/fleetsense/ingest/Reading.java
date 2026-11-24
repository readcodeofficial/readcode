package io.fleetsense.ingest;

import java.time.Instant;
import java.util.List;

public record Reading(String sensor, Instant at, double value) {}

interface ReadingStore {
    void append(String deviceId, List<Reading> readings);
}
