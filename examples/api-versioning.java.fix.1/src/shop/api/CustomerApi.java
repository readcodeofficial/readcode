package shop.api;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class CustomerApi {
    public record Response(int status, Map<String, String> headers, Object body) {}

    public static final String VERSION_HEADER = "X-Api-Version";

    private final Versions versions = new Versions(List.of("1.0", "1.2", "1.9", "1.10"));
    private final Map<String, Customer> customers = new HashMap<>();

    public void save(Customer c) {
        customers.put(c.id(), c);
    }

    public Response get(String id, Map<String, String> requestHeaders) {
        String requested = requestHeaders.get(VERSION_HEADER);
        String version = requested == null ? versions.oldest() : versions.resolve(requested);
        if (version == null) {
            return new Response(400, Map.of(), Map.of("error", "unsupported version " + requested));
        }
        Customer c = customers.get(id);
        if (c == null) return new Response(404, Map.of(), Map.of("error", "no such customer"));
        return new Response(200, Map.of("X-Resolved-Version", version), CustomerView.render(c, version));
    }

    public Response list(Map<String, String> requestHeaders) {
        String requested = requestHeaders.get(VERSION_HEADER);
        String version = requested == null ? versions.oldest() : versions.resolve(requested);
        if (version == null) {
            return new Response(400, Map.of(), Map.of("error", "unsupported version " + requested));
        }
        List<Object> items = new ArrayList<>();
        for (Customer c : customers.values()) items.add(CustomerView.render(c, version));
        return new Response(200, Map.of("X-Resolved-Version", version), items);
    }
}
