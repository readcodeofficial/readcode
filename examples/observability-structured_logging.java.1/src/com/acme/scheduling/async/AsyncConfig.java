package com.acme.scheduling.async;

import java.util.Map;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class AsyncConfig {

    static class MdcTaskDecorator implements TaskDecorator {
        @Override
        public Runnable decorate(Runnable task) {
            Map<String, String> submitterContext = MDC.getCopyOfContextMap();
            return () -> {
                Map<String, String> workerContext = MDC.getCopyOfContextMap();
                try {
                    if (submitterContext != null) {
                        MDC.setContextMap(submitterContext);
                    } else {
                        MDC.clear();
                    }
                    task.run();
                } finally {
                    if (workerContext != null) {
                        MDC.setContextMap(workerContext);
                    } else {
                        MDC.clear();
                    }
                }
            };
        }
    }

    @Bean("reminderExecutor")
    ThreadPoolTaskExecutor reminderExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("reminder-");
        executor.setTaskDecorator(new MdcTaskDecorator());
        return executor;
    }
}
