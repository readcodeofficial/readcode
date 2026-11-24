package com.shopwave.inventory.events;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopwave.inventory.InventoryService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

@Component
public class OrderEventListener {

    private static final Logger log = LoggerFactory.getLogger(OrderEventListener.class);

    private final ObjectMapper mapper;
    private final ProcessedEventStore processedEvents;
    private final InventoryService inventory;

    public OrderEventListener(ObjectMapper mapper, ProcessedEventStore processedEvents, InventoryService inventory) {
        this.mapper = mapper;
        this.processedEvents = processedEvents;
        this.inventory = inventory;
    }

    @KafkaListener(topics = "orders.placed", groupId = "inventory-reservations")
    public void onOrderPlaced(ConsumerRecord<String, String> record, Acknowledgment ack)
            throws JsonProcessingException {
        OrderPlaced event = mapper.readValue(record.value(), OrderPlaced.class);

        if (!processedEvents.markProcessed(event.eventId(), "inventory-reservations")) {
            log.info("skipping duplicate event {} for order {} (partition {}, offset {})",
                    event.eventId(), event.orderId(), record.partition(), record.offset());
            ack.acknowledge();
            return;
        }

        inventory.reserve(event.orderId(), event.lines());
        ack.acknowledge();
    }
}
