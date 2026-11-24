package com.parcelway.shipping.service;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.parcelway.shipping.domain.Shipment;
import com.parcelway.shipping.domain.ShipmentRepository;
import com.parcelway.shipping.outbox.OutboxEvent;

@Service
public class ShipmentService {

    record ShipmentDispatched(UUID shipmentId, String carrierRef, Instant at) {}

    private final ShipmentRepository shipments;
    private final OutboxEvent.Repository outbox;
    private final ObjectMapper mapper;
    private final Clock clock;

    public ShipmentService(ShipmentRepository shipments, OutboxEvent.Repository outbox,
                           ObjectMapper mapper, Clock clock) {
        this.shipments = shipments;
        this.outbox = outbox;
        this.mapper = mapper;
        this.clock = clock;
    }

    @Transactional
    public void dispatch(UUID shipmentId, String carrierRef) {
        Shipment shipment = shipments.findById(shipmentId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown shipment " + shipmentId));
        Instant now = clock.instant();
        shipment.dispatch(carrierRef, now);

        try {
            String payload = mapper.writeValueAsString(
                    new ShipmentDispatched(shipmentId, carrierRef, now));
            outbox.save(new OutboxEvent(shipmentId.toString(), "ShipmentDispatched", payload));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialise event for " + shipmentId, e);
        }
    }
}
