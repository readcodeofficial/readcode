package io.fleetsense.ingest.ratelimit;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ingest.ratelimit")
public record RateLimitProperties(
        long readingsPerSecond,
        long burstReadings,
        Duration idleEviction,
        int maxTrackedDevices,
        int maxBatchSize) {

    public RateLimitProperties {
        if (readingsPerSecond <= 0 || burstReadings < readingsPerSecond) {
            throw new IllegalArgumentException("burstReadings must be >= readingsPerSecond > 0");
        }
        if (maxBatchSize <= 0 || maxBatchSize > burstReadings) {
            throw new IllegalArgumentException("a full batch must fit inside the burst");
        }
    }
}
