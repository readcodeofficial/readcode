package shop;

import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

public final class Degrade {
    private Degrade() {}

    /**
     * Wraps a non-essential dependency call: whatever goes wrong (an error or no answer
     * within the timeout) the caller gets the fallback value instead of a failure.
     */
    public static <T> CompletableFuture<T> optional(
            CompletableFuture<T> future, Duration timeout, T fallback, Runnable onFallback) {
        return future
                .exceptionally(error -> {
                    onFallback.run();
                    return fallback;
                })
                .orTimeout(timeout.toMillis(), TimeUnit.MILLISECONDS);
    }
}
