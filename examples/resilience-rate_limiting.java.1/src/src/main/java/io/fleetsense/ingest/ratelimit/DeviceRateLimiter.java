package io.fleetsense.ingest.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import java.time.Duration;
import org.springframework.stereotype.Component;

/** Per-device token bucket. One token is one sensor reading. */
@Component
public class DeviceRateLimiter {

    private final RateLimitProperties props;
    private final Cache<String, Bucket> buckets;

    public DeviceRateLimiter(RateLimitProperties props) {
        this.props = props;
        this.buckets = Caffeine.newBuilder()
                .maximumSize(props.maxTrackedDevices())
                .expireAfterAccess(props.idleEviction())
                .build();
    }

    public ConsumptionProbe tryAcquire(String deviceId, long readings) {
        Bucket bucket = buckets.get(deviceId, id -> newBucket());
        return bucket.tryConsumeAndReturnRemaining(readings);
    }

    private Bucket newBucket() {
        Bandwidth limit = Bandwidth.builder()
                .capacity(props.burstReadings())
                .refillGreedy(props.readingsPerSecond(), Duration.ofSeconds(1))
                .build();
        return Bucket.builder().addLimit(limit).build();
    }
}
