package com.helpdesk.projector;

import java.util.Map;

import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.KafkaOperations;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.util.backoff.FixedBackOff;

@Configuration
public class KafkaConsumerConfig {

    @Bean
    ConsumerFactory<String, TicketEvent> ticketEventConsumerFactory(KafkaConnectionProps props) {
        Map<String, Object> config = Map.of(
                ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, props.bootstrapServers(),
                ConsumerConfig.GROUP_ID_CONFIG, "ticket-projector",
                ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false,
                ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest",
                ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 100,
                ErrorHandlingDeserializer.KEY_DESERIALIZER_CLASS, StringDeserializer.class,
                ErrorHandlingDeserializer.VALUE_DESERIALIZER_CLASS, JsonDeserializer.class,
                JsonDeserializer.VALUE_DEFAULT_TYPE, TicketEvent.class.getName(),
                JsonDeserializer.TRUSTED_PACKAGES, "com.helpdesk.projector");
        return new DefaultKafkaConsumerFactory<>(config,
                new ErrorHandlingDeserializer<>(new StringDeserializer()),
                new ErrorHandlingDeserializer<>(new JsonDeserializer<>(TicketEvent.class)));
    }

    @Bean
    ConcurrentKafkaListenerContainerFactory<String, TicketEvent> ticketEventFactory(
            ConsumerFactory<String, TicketEvent> consumerFactory,
            KafkaOperations<Object, Object> template) {
        var factory = new ConcurrentKafkaListenerContainerFactory<String, TicketEvent>();
        factory.setConsumerFactory(consumerFactory);
        factory.setConcurrency(3);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);

        var recoverer = new DeadLetterPublishingRecoverer(template);
        var errorHandler = new DefaultErrorHandler(recoverer, new FixedBackOff(1_000L, 3));
        errorHandler.addNotRetryableExceptions(IllegalArgumentException.class);
        factory.setCommonErrorHandler(errorHandler);
        return factory;
    }

    public record KafkaConnectionProps(String bootstrapServers) {
    }
}
