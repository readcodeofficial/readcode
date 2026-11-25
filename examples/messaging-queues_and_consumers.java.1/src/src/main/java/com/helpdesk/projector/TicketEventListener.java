package com.helpdesk.projector;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

@Component
public class TicketEventListener {

    private static final Logger log = LoggerFactory.getLogger(TicketEventListener.class);

    private final TicketProjector projector;

    public TicketEventListener(TicketProjector projector) {
        this.projector = projector;
    }

    @KafkaListener(id = "ticket-projector", topics = "support.ticket-events",
            containerFactory = "ticketEventFactory")
    public void onEvent(ConsumerRecord<String, TicketEvent> record, Acknowledgment ack) {
        TicketEvent event = record.value();
        if (event == null) {
            throw new IllegalArgumentException("undeserializable record at offset " + record.offset());
        }
        try {
            projector.apply(event);
        } catch (TransientProjectionException ex) {
            log.warn("Projection of ticket {} deferred at {}-{}@{}: {}", event.ticketId(),
                    record.topic(), record.partition(), record.offset(), ex.getMessage());
            return;
        }
        ack.acknowledge();
    }
}
