package com.parcelway.shipping.outbox;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import jakarta.persistence.*;

@Entity
@Table(name = "outbox_event")
public class OutboxEvent {

    @Id
    private UUID id = UUID.randomUUID();

    @Column(nullable = false)
    private String aggregateId;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false, columnDefinition = "text")
    private String payload;

    private Instant createdAt = Instant.now();
    private Instant publishedAt;

    protected OutboxEvent() {}

    public OutboxEvent(String aggregateId, String type, String payload) {
        this.aggregateId = aggregateId;
        this.type = type;
        this.payload = payload;
    }

    public void markPublished(Instant at) { this.publishedAt = at; }

    public UUID getId() { return id; }
    public String getAggregateId() { return aggregateId; }
    public String getType() { return type; }
    public String getPayload() { return payload; }

    public interface Repository extends JpaRepository<OutboxEvent, UUID> {
        @Lock(LockModeType.PESSIMISTIC_WRITE)
        List<OutboxEvent> findTop50ByPublishedAtIsNullOrderByCreatedAtAsc();
    }
}
