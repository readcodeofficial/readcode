package warehouse.health;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class HealthRegistry {

    @FunctionalInterface
    public interface Check {
        Status run() throws Exception;
    }

    public record Registration(String name, boolean critical, Check check) {}

    private final List<Registration> registrations = new ArrayList<>();

    public HealthRegistry register(String name, boolean critical, Check check) {
        registrations.add(new Registration(name, critical, check));
        return this;
    }

    public HealthReport run() {
        Map<String, Status> components = new LinkedHashMap<>();
        Status overall = Status.UP;
        for (Registration registration : registrations) {
            Status status = evaluate(registration);
            components.put(registration.name(), status);
            if (status == Status.DOWN) {
                overall = registration.critical() ? Status.DOWN : Status.DEGRADED;
            } else if (status == Status.DEGRADED && overall == Status.UP) {
                overall = Status.DEGRADED;
            }
        }
        return new HealthReport(overall, components);
    }

    private Status evaluate(Registration registration) {
        try {
            Status status = registration.check().run();
            return status == null ? Status.DOWN : status;
        } catch (Exception e) {
            return Status.DOWN;
        }
    }
}
