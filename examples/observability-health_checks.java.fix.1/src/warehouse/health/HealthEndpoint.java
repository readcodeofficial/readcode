package warehouse.health;

import java.util.Map;
import java.util.StringJoiner;

public final class HealthEndpoint {

    public record Response(int code, String body) {}

    private final HealthRegistry registry;

    public HealthEndpoint(HealthRegistry registry) {
        this.registry = registry;
    }

    public Response readiness() {
        HealthReport report = registry.run();
        int code = report.isReady() ? 200 : 503;
        return new Response(code, render(report));
    }

    private static String render(HealthReport report) {
        StringJoiner components = new StringJoiner(",", "{", "}");
        report.components().entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(e -> components.add("\"" + e.getKey() + "\":\"" + e.getValue() + "\""));
        return "{\"status\":\"" + report.status() + "\",\"components\":" + components + "}";
    }
}
