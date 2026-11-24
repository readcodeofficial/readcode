package com.ridedispatch.tracking;

import io.micrometer.core.instrument.MeterRegistry;
import java.util.List;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

@Component
public class LocationUpdateListener {

    private static final Logger log = LoggerFactory.getLogger(LocationUpdateListener.class);

    private final SessionSequenceFilter filter;
    private final PositionStore positions;
    private final MeterRegistry meters;

    public LocationUpdateListener(SessionSequenceFilter filter, PositionStore positions, MeterRegistry meters) {
        this.filter = filter;
        this.positions = positions;
        this.meters = meters;
    }

    @KafkaListener(topics = "driver.location.v1", groupId = "dispatch-tracking",
            containerFactory = "locationBatchFactory")
    public void onBatch(List<ConsumerRecord<String, LocationUpdate>> records, Acknowledgment ack) {
        for (ConsumerRecord<String, LocationUpdate> record : records) {
            LocationUpdate update = record.value();
            SessionSequenceFilter.Verdict verdict = filter.check(update);
            meters.counter("tracking.location.verdict", "verdict", verdict.name()).increment();

            if (verdict != SessionSequenceFilter.Verdict.ACCEPTED) {
                continue;
            }
            try {
                positions.upsertLatest(update);
            } catch (RuntimeException e) {
                log.warn("position write failed driver={} partition={} offset={}",
                        update.driverId(), record.partition(), record.offset(), e);
                filter.forget(update.driverId());
                throw e;
            }
        }
        ack.acknowledge();
    }
}

interface PositionStore {
    void upsertLatest(LocationUpdate update);
}
