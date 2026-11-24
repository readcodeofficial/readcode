package com.parcelway.tracking.consumer;

import java.nio.charset.StandardCharsets;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.parcelway.tracking.TrackingService;

@Component
public class ShipmentEventConsumer {

    private final ProcessedEventRepository processed;
    private final TrackingService tracking;

    public ShipmentEventConsumer(ProcessedEventRepository processed, TrackingService tracking) {
        this.processed = processed;
        this.tracking = tracking;
    }

    @KafkaListener(topics = "shipment-events", groupId = "tracking")
    @Transactional
    public void onEvent(ConsumerRecord<String, String> record) {
        String eventId = new String(record.headers().lastHeader("event-id").value(),
                StandardCharsets.UTF_8);
        if (processed.insertIfNew(eventId) == 0) {
            return;
        }
        tracking.apply(record.key(), record.value());
    }

    public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, String> {
        @Modifying
        @Query(value = "INSERT INTO processed_event (event_id) VALUES (:id) "
                + "ON CONFLICT (event_id) DO NOTHING", nativeQuery = true)
        int insertIfNew(@org.springframework.data.repository.query.Param("id") String id);
    }
}
