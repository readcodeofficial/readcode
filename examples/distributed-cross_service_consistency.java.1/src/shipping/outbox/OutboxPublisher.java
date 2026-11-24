package com.parcelway.shipping.outbox;

import java.time.Clock;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.apache.kafka.clients.producer.ProducerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class OutboxPublisher {

    private static final Logger log = LoggerFactory.getLogger(OutboxPublisher.class);
    private static final String TOPIC = "shipment-events";

    private final OutboxEvent.Repository outbox;
    private final KafkaTemplate<String, String> kafka;
    private final Clock clock;

    public OutboxPublisher(OutboxEvent.Repository outbox, KafkaTemplate<String, String> kafka,
                           Clock clock) {
        this.outbox = outbox;
        this.kafka = kafka;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${parcelway.outbox.poll-ms:500}")
    @Transactional
    public void publishPending() {
        List<OutboxEvent> batch = outbox.findTop50ByPublishedAtIsNullOrderByCreatedAtAsc();
        for (OutboxEvent event : batch) {
            ProducerRecord<String, String> record =
                    new ProducerRecord<>(TOPIC, event.getAggregateId(), event.getPayload());
            record.headers().add("event-id", event.getId().toString().getBytes());
            record.headers().add("event-type", event.getType().getBytes());
            try {
                kafka.send(record).get(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
                log.warn("Outbox publish failed for event {}, will retry", event.getId(), e);
                return;
            }
            event.markPublished(clock.instant());
        }
    }
}
