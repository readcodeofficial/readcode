package com.streamly.playback;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.errors.WakeupException;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

public class PlaybackStateConsumer implements Runnable {
    private static final Logger log = LoggerFactory.getLogger(PlaybackStateConsumer.class);

    private final KafkaConsumer<String, String> consumer;
    private final SessionProjection projection;
    private final ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    public PlaybackStateConsumer(String bootstrapServers, String groupId, SessionProjection projection) {
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false");
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 500);
        this.consumer = new KafkaConsumer<>(props);
        this.projection = projection;
    }

    @Override
    public void run() {
        try {
            consumer.subscribe(List.of(PlaybackEventPublisher.TOPIC));
            while (true) {
                ConsumerRecords<String, String> batch = consumer.poll(Duration.ofMillis(500));
                Map<TopicPartition, OffsetAndMetadata> processed = new HashMap<>();

                for (TopicPartition tp : batch.partitions()) {
                    for (ConsumerRecord<String, String> record : batch.records(tp)) {
                        try {
                            projection.apply(mapper.readValue(record.value(), PlaybackEvent.class));
                            processed.put(tp, new OffsetAndMetadata(record.offset() + 1));
                        } catch (Exception e) {
                            log.warn("Failed {}-{}@{}, will redeliver", tp.topic(), tp.partition(), record.offset(), e);
                            consumer.seek(tp, record.offset());
                            break;
                        }
                    }
                }

                if (!processed.isEmpty()) {
                    consumer.commitSync(processed);
                }
            }
        } catch (WakeupException shutdown) {
            log.info("Playback consumer shutting down");
        } finally {
            consumer.close();
        }
    }

    public void stop() {
        consumer.wakeup();
    }
}
