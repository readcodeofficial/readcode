package com.fleetbite.orders.health;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.DescribeClusterOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component("orderQueue")
public class OrderQueueHealthIndicator implements HealthIndicator {

    private final AdminClient admin;
    private final long timeoutMs;

    public OrderQueueHealthIndicator(
            AdminClient admin,
            @Value("${fleetbite.health.kafka-timeout-ms:1500}") long timeoutMs) {
        this.admin = admin;
        this.timeoutMs = timeoutMs;
    }

    @Override
    public Health health() {
        try {
            var cluster = admin.describeCluster(
                    new DescribeClusterOptions().timeoutMs((int) timeoutMs));
            int brokers = cluster.nodes().get(timeoutMs, TimeUnit.MILLISECONDS).size();
            if (brokers == 0) {
                return Health.down().withDetail("reason", "no brokers reported").build();
            }
            return Health.up().withDetail("brokers", brokers).build();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Health.down(e).build();
        } catch (ExecutionException | TimeoutException e) {
            return Health.down(e).withDetail("timeoutMs", timeoutMs).build();
        }
    }
}
