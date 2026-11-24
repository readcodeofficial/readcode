package com.parcelway.shipping.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.*;

@Entity
@Table(name = "shipment")
public class Shipment {

    public enum Status { READY, DISPATCHED, DELIVERED }

    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    private Status status;

    private String carrierRef;
    private Instant dispatchedAt;

    @Version
    private long version;

    protected Shipment() {}

    public Shipment(UUID id) {
        this.id = id;
        this.status = Status.READY;
    }

    public void dispatch(String carrierRef, Instant now) {
        if (status != Status.READY) {
            throw new IllegalStateException("Shipment " + id + " is " + status);
        }
        this.status = Status.DISPATCHED;
        this.carrierRef = carrierRef;
        this.dispatchedAt = now;
    }

    public UUID getId() { return id; }
    public Status getStatus() { return status; }
}
