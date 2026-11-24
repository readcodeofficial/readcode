package com.sensorgrid.ingest;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

class InMemoryReadingStore implements ReadingStore {

    private final Map<String, Reading> latestByDevice = new HashMap<>();

    @Override
    public boolean saveIfNewer(Reading reading) {
        Reading current = latestByDevice.get(reading.deviceId());
        if (current != null && !reading.recordedAt().isAfter(current.recordedAt())) {
            return false;
        }
        latestByDevice.put(reading.deviceId(), reading);
        return true;
    }

    @Override
    public Optional<Reading> latest(String deviceId) {
        return Optional.ofNullable(latestByDevice.get(deviceId));
    }
}
