package warehouse.health;

import java.util.Map;

public record HealthReport(Status status, Map<String, Status> components) {

    public HealthReport {
        components = Map.copyOf(components);
    }

    public boolean isReady() {
        return status != Status.DOWN;
    }
}
