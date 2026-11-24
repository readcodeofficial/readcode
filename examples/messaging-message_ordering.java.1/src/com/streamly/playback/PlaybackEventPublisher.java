package com.streamly.playback;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.serialization.StringSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Properties;

public class PlaybackEventPublisher implements AutoCloseable {
    private static final Logger log = LoggerFactory.getLogger(PlaybackEventPublisher.class);
    static final String TOPIC = "playback-events";

    private final KafkaProducer<String, String> producer;
    private final ObjectMapper mapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    public PlaybackEventPublisher(String bootstrapServers) {
        Properties props = new Properties();
        props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class.getName());
        props.put(ProducerConfig.ACKS_CONFIG, "1");
        props.put(ProducerConfig.RETRIES_CONFIG, Integer.MAX_VALUE);
        props.put(ProducerConfig.MAX_IN_FLIGHT_REQUESTS_PER_CONNECTION, 5);
        props.put(ProducerConfig.LINGER_MS_CONFIG, 20);
        props.put(ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG, 30_000);
        this.producer = new KafkaProducer<>(props);
    }

    public void publish(PlaybackEvent event) {
        try {
            String json = mapper.writeValueAsString(event);
            producer.send(new ProducerRecord<>(TOPIC, event.sessionId(), json), (metadata, error) -> {
                if (error != null) {
                    log.error("Dropped {} for session {} seq {}", event.type(), event.sessionId(), event.seq(), error);
                }
            });
        } catch (Exception e) {
            throw new IllegalStateException("Cannot serialize playback event", e);
        }
    }

    @Override
    public void close() {
        producer.close();
    }
}
