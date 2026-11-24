package io.fleetpulse.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.bulkhead.Bulkhead;
import io.github.resilience4j.bulkhead.BulkheadConfig;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.decorators.Decorators;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

public class DeviceStatusService {

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(1))
            .build();
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    private final URI gatewayBase;
    private final StatusCache cache;

    private final CircuitBreaker breaker = CircuitBreaker.of("telemetry-gateway",
            CircuitBreakerConfig.custom()
                    .slidingWindowSize(20)
                    .failureRateThreshold(50)
                    .waitDurationInOpenState(Duration.ofSeconds(15))
                    .build());
    private final Bulkhead bulkhead = Bulkhead.of("telemetry-gateway",
            BulkheadConfig.custom()
                    .maxConcurrentCalls(25)
                    .maxWaitDuration(Duration.ZERO)
                    .build());

    public DeviceStatusService(URI gatewayBase, StatusCache cache) {
        this.gatewayBase = gatewayBase;
        this.cache = cache;
    }

    public DeviceStatus getStatus(String deviceId) {
        return Decorators.ofSupplier(() -> fetchStatus(deviceId))
                .withBulkhead(bulkhead)
                .withCircuitBreaker(breaker)
                .withFallback(List.of(CallNotPermittedException.class), e -> lastKnownStatus(deviceId, e))
                .get();
    }

    public Map<String, Integer> getFleetSummary(String fleetId) {
        return Decorators.ofSupplier(() -> fetchSummary(fleetId))
                .withCircuitBreaker(breaker)
                .withFallback(e -> Map.of("online", -1, "offline", -1))
                .get();
    }

    private DeviceStatus lastKnownStatus(String deviceId, Throwable cause) {
        return cache.getUsable(deviceId)
                .map(DeviceStatus::asDegraded)
                .orElseThrow(() -> new StatusUnavailableException(deviceId, cause));
    }

    private DeviceStatus fetchStatus(String deviceId) {
        DeviceStatus fresh = get("/devices/" + deviceId + "/status", DeviceStatus.class);
        cache.put(fresh);
        return fresh;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Integer> fetchSummary(String fleetId) {
        return get("/fleets/" + fleetId + "/summary", Map.class);
    }

    private <T> T get(String path, Class<T> type) {
        HttpRequest request = HttpRequest.newBuilder(gatewayBase.resolve(path))
                .timeout(Duration.ofSeconds(2))
                .GET()
                .build();
        try {
            HttpResponse<byte[]> response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() >= 500) {
                throw new IllegalStateException("gateway returned " + response.statusCode());
            }
            return mapper.readValue(response.body(), type);
        } catch (IOException e) {
            throw new IllegalStateException("gateway call failed: " + path, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted: " + path, e);
        }
    }

    public static class StatusUnavailableException extends RuntimeException {
        public StatusUnavailableException(String deviceId, Throwable cause) {
            super("no usable status for device " + deviceId, cause);
        }
    }
}
