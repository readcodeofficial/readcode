package com.streamly.watchhistory;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

@Component
public class PlaybackEventListener {

    private static final Logger log = LoggerFactory.getLogger(PlaybackEventListener.class);

    private final ProcessedEventStore processedEvents;
    private final WatchHistoryRepository watchHistory;

    public PlaybackEventListener(ProcessedEventStore processedEvents, WatchHistoryRepository watchHistory) {
        this.processedEvents = processedEvents;
        this.watchHistory = watchHistory;
    }

    @KafkaListener(
            topics = "playback.events",
            groupId = "watch-history",
            containerFactory = "manualAckContainerFactory")
    public void onPlaybackEvent(ConsumerRecord<String, PlaybackEvent> record, Acknowledgment ack) {
        PlaybackEvent event = record.value();

        if (!processedEvents.markIfNew(event.eventId())) {
            log.debug("Skipping already processed event {}", event.eventId());
            ack.acknowledge();
            return;
        }

        watchHistory.apply(event);
        ack.acknowledge();
    }
}
