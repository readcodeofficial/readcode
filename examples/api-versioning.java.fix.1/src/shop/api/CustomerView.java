package shop.api;

import java.util.LinkedHashMap;
import java.util.Map;

/** Renders a customer in the shape of a given API version. */
public final class CustomerView {
    private CustomerView() {}

    public static Map<String, Object> render(Customer c, String version) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", c.id());
        if (Versions.atLeast(version, "1.10")) {
            out.put("firstName", c.firstName());
            out.put("lastName", c.lastName());
        } else {
            out.put("name", c.firstName() + " " + c.lastName());
        }
        if (Versions.atLeast(version, "1.2")) out.put("email", c.email());
        if (Versions.atLeast(version, "1.9")) out.put("phone", c.phone());
        return out;
    }
}
