package warehouse.health;

import java.util.function.BooleanSupplier;
import java.util.function.IntSupplier;

public final class Checks {

    private Checks() {}

    public static HealthRegistry.Check ping(BooleanSupplier reachable) {
        return () -> reachable.getAsBoolean() ? Status.UP : Status.DOWN;
    }

    public static HealthRegistry.Check queueDepth(IntSupplier depth, int degradedAt, int downAt) {
        return () -> {
            int current = depth.getAsInt();
            if (current >= downAt) {
                return Status.DOWN;
            }
            return current >= degradedAt ? Status.DEGRADED : Status.UP;
        };
    }
}
