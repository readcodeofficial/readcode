package io.fleetsense.ingest;

import io.fleetsense.ingest.ratelimit.DeviceRateLimiter;
import io.fleetsense.ingest.ratelimit.RateLimitProperties;
import io.github.bucket4j.ConsumptionProbe;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/telemetry")
public class TelemetryController {

    private static final Logger log = LoggerFactory.getLogger(TelemetryController.class);

    private final DeviceRateLimiter limiter;
    private final ReadingStore store;
    private final RateLimitProperties props;

    public TelemetryController(DeviceRateLimiter limiter, ReadingStore store, RateLimitProperties props) {
        this.limiter = limiter;
        this.store = store;
        this.props = props;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> ingest(
            @RequestHeader("X-Device-Id") String deviceId, @RequestBody List<Reading> readings) {
        if (readings.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "empty batch"));
        }
        if (readings.size() > props.maxBatchSize()) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(Map.of("error", "batch exceeds " + props.maxBatchSize() + " readings"));
        }

        ConsumptionProbe probe = limiter.tryAcquire(deviceId, 1);
        if (!probe.isConsumed()) {
            long waitSeconds = TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()) + 1;
            log.warn("rate limited device={} batch={} retryAfter={}s", deviceId, readings.size(), waitSeconds);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header(HttpHeaders.RETRY_AFTER, Long.toString(waitSeconds))
                    .body(Map.of("error", "rate limit exceeded"));
        }

        store.append(deviceId, readings);
        return ResponseEntity.accepted()
                .body(Map.of("accepted", readings.size(), "remainingBurst", probe.getRemainingTokens()));
    }
}
