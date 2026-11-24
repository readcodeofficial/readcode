package com.streamhub.transcode.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class TranscodeTopics {

    public static final String JOBS = "transcode.jobs";
    public static final String JOBS_DLT = JOBS + ".DLT";

    @Bean
    NewTopic transcodeJobs() {
        return TopicBuilder.name(JOBS)
                .partitions(12)
                .replicas(3)
                .build();
    }

    @Bean
    NewTopic transcodeJobsDlt() {
        return TopicBuilder.name(JOBS_DLT)
                .partitions(3)
                .replicas(3)
                .config("retention.ms", String.valueOf(14L * 24 * 60 * 60 * 1000))
                .build();
    }
}
