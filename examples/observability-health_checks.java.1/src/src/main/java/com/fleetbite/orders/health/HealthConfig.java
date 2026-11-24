package com.fleetbite.orders.health;

import java.util.Map;

import org.apache.kafka.clients.admin.AdminClient;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class HealthConfig {

    @Bean(destroyMethod = "close")
    AdminClient healthAdminClient(KafkaProperties properties) {
        Map<String, Object> config = properties.buildAdminProperties(null);
        config.put("request.timeout.ms", 2000);
        config.put("default.api.timeout.ms", 2000);
        return AdminClient.create(config);
    }
}
