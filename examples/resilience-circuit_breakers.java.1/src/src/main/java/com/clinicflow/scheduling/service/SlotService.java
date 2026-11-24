package com.clinicflow.scheduling.service;

import com.clinicflow.scheduling.ehr.EhrAvailabilityClient;
import com.clinicflow.scheduling.ehr.Slot;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SlotService {

    private static final Logger log = LoggerFactory.getLogger(SlotService.class);

    private final EhrAvailabilityClient client;
    private final SlotSnapshotCache snapshots;
    private final CircuitBreaker breaker;

    public SlotService(EhrAvailabilityClient client, SlotSnapshotCache snapshots, CircuitBreakerRegistry registry) {
        this.client = client;
        this.snapshots = snapshots;
        this.breaker = registry.circuitBreaker("ehr-availability");
        this.breaker.getEventPublisher().onStateTransition(
                event -> log.warn("EHR breaker transition {}", event.getStateTransition()));
    }

    public List<Slot> openSlots(String clinicId, LocalDate day) {
        Supplier<List<Slot>> guarded = CircuitBreaker.decorateSupplier(breaker, () -> {
            try {
                List<Slot> fresh = client.fetchSlots(clinicId, day);
                snapshots.store(clinicId, day, fresh);
                return fresh;
            } catch (IOException e) {
                log.warn("EHR slot fetch failed for clinic {}", clinicId, e);
                return snapshots.latest(clinicId, day);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("Interrupted while fetching slots", e);
            }
        });

        try {
            return guarded.get();
        } catch (CallNotPermittedException e) {
            log.info("EHR breaker open, serving snapshot for clinic {}", clinicId);
            return snapshots.latest(clinicId, day);
        }
    }

    public boolean isDegraded() {
        return breaker.getState() != CircuitBreaker.State.CLOSED;
    }
}
