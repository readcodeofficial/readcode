package com.gatekeep.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.consumer.ConsumerRebalanceListener;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.errors.WakeupException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;

public class LoginAuditConsumer implements Runnable {

    private static final Logger log = LoggerFactory.getLogger(LoginAuditConsumer.class);

    static final int LANES = 4;
    static final int LANE_CAPACITY = 500;
    static final int HIGH_WATERMARK = 300;
    static final int LOW_WATERMARK = 100;
    // The consumer is configured with max.poll.records=100, so one poll can add at most
    // 100 records to a single lane: HIGH_WATERMARK + 100 < LANE_CAPACITY.

    private final KafkaConsumer<String, String> consumer;
    private final AuditSink sink;
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
    private final List<ThreadPoolExecutor> lanes;
    private final Map<TopicPartition, Long> completed = new ConcurrentHashMap<>();
    private final Map<TopicPartition, Long> committed = new HashMap<>();
    private boolean paused = false;

    public LoginAuditConsumer(KafkaConsumer<String, String> consumer, AuditSink sink) {
        this.consumer = consumer;
        this.sink = sink;
        this.lanes = IntStream.range(0, LANES)
                .mapToObj(i -> new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS,
                        new ArrayBlockingQueue<>(LANE_CAPACITY),
                        r -> new Thread(r, "audit-lane-" + i),
                        new ThreadPoolExecutor.AbortPolicy()))
                .toList();
    }

    @Override
    public void run() {
        consumer.subscribe(List.of("auth.login-events"), new ConsumerRebalanceListener() {
            @Override
            public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
                commitCompleted();
                completed.keySet().removeAll(partitions);
                committed.keySet().removeAll(partitions);
            }

            @Override
            public void onPartitionsAssigned(Collection<TopicPartition> partitions) {
                if (paused) {
                    consumer.pause(partitions);
                }
            }
        });
        try {
            while (true) {
                applyBackpressure();
                ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
                for (ConsumerRecord<String, String> record : records) {
                    dispatch(record);
                }
                commitCompleted();
            }
        } catch (WakeupException expected) {
            log.info("login audit consumer stopping");
        } finally {
            drainAndClose();
        }
    }

    public void stop() {
        consumer.wakeup();
    }

    private void applyBackpressure() {
        int deepest = lanes.stream().mapToInt(l -> l.getQueue().size()).max().orElse(0);
        if (!paused && deepest >= HIGH_WATERMARK) {
            consumer.pause(consumer.assignment());
            paused = true;
            log.warn("pausing consumption, deepest lane has {} queued", deepest);
        } else if (paused && deepest <= LOW_WATERMARK) {
            consumer.resume(consumer.paused());
            paused = false;
            log.info("resuming consumption, deepest lane has {} queued", deepest);
        }
    }

    private void dispatch(ConsumerRecord<String, String> record) {
        TopicPartition tp = new TopicPartition(record.topic(), record.partition());
        lanes.get(Math.floorMod(record.partition(), LANES)).execute(() -> {
            LoginEvent event;
            try {
                event = mapper.readValue(record.value(), LoginEvent.class);
            } catch (IOException e) {
                log.error("skipping malformed event at {}-{}@{}", record.topic(),
                        record.partition(), record.offset(), e);
                completed.merge(tp, record.offset() + 1, Math::max);
                return;
            }
            if (writeWithRetry(event)) {
                completed.merge(tp, record.offset() + 1, Math::max);
            }
        });
    }

    private boolean writeWithRetry(LoginEvent event) {
        while (true) {
            try {
                sink.write(event);
                return true;
            } catch (Exception e) {
                log.warn("audit sink write failed for {}, retrying", event.eventId(), e);
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return false;
                }
            }
        }
    }

    private void commitCompleted() {
        Map<TopicPartition, OffsetAndMetadata> toCommit = new HashMap<>();
        for (TopicPartition tp : consumer.assignment()) {
            Long done = completed.get(tp);
            if (done != null && done > committed.getOrDefault(tp, -1L)) {
                toCommit.put(tp, new OffsetAndMetadata(done));
            }
        }
        if (!toCommit.isEmpty()) {
            consumer.commitSync(toCommit);
            toCommit.forEach((tp, offset) -> committed.put(tp, offset.offset()));
        }
    }

    private void drainAndClose() {
        lanes.forEach(ThreadPoolExecutor::shutdown);
        try {
            for (ThreadPoolExecutor lane : lanes) {
                lane.awaitTermination(30, TimeUnit.SECONDS);
            }
            commitCompleted();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            consumer.close();
        }
    }
}
