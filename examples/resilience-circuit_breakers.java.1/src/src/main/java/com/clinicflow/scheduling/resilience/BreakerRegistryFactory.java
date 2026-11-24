package com.clinicflow.scheduling.resilience;

import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeoutException;

public final class BreakerRegistryFactory {

    private BreakerRegistryFactory() {
    }

    public static CircuitBreakerRegistry create() {
        CircuitBreakerConfig ehr = CircuitBreakerConfig.custom()
                .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                .slidingWindowSize(20)
                .minimumNumberOfCalls(10)
                .failureRateThreshold(50f)
                .slowCallDurationThreshold(Duration.ofSeconds(2))
                .slowCallRateThreshold(80f)
                .waitDurationInOpenState(Duration.ofSeconds(30))
                .permittedNumberOfCallsInHalfOpenState(3)
                .automaticTransitionFromOpenToHalfOpenEnabled(true)
                .recordExceptions(IOException.class, TimeoutException.class, EhrServerException.class)
                .ignoreExceptions(UnknownClinicException.class)
                .build();

        return CircuitBreakerRegistry.of(Map.of("ehr-availability", ehr));
    }
}
