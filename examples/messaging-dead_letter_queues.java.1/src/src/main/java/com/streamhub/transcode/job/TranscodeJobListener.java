package com.streamhub.transcode.job;

import com.streamhub.transcode.config.TranscodeTopics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

@Component
public class TranscodeJobListener {

    private static final Logger log = LoggerFactory.getLogger(TranscodeJobListener.class);

    private final ProfileResolver profiles;
    private final TranscoderClient transcoder;

    public TranscodeJobListener(ProfileResolver profiles, TranscoderClient transcoder) {
        this.profiles = profiles;
        this.transcoder = transcoder;
    }

    @KafkaListener(topics = TranscodeTopics.JOBS, groupId = "transcode-workers")
    public void onJob(TranscodeJob job, @Header(KafkaHeaders.OFFSET) long offset) {
        if (job.assetId() == null || job.sourceUri() == null || job.sourceUri().isBlank()) {
            throw new MalformedJobException("job at offset " + offset + " has no asset or source");
        }

        EncodingProfile profile = profiles.resolve(job.codec(), job.targetHeight());
        log.info("submitting asset={} profile={} offset={}", job.assetId(), profile.name(), offset);

        // Throws TranscoderUnavailableException (a RuntimeException) on 5xx or timeout.
        transcoder.submit(job.assetId(), job.sourceUri(), profile);
    }
}
