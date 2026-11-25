package shop.api;

import java.util.ArrayList;
import java.util.List;

/** Knows which API versions exist and which one a client's requested version maps to. */
public final class Versions {
    private final List<String> supported = new ArrayList<>();

    public Versions(List<String> supportedVersions) {
        supported.addAll(supportedVersions);
        supported.sort(Versions::compare);
    }

    public static int compare(String a, String b) {
        return a.compareTo(b);
    }

    public static boolean atLeast(String version, String minimum) {
        return compare(version, minimum) >= 0;
    }

    public String oldest() {
        return supported.get(0);
    }

    /** The newest supported version that does not exceed the requested one, or null if the request predates them all. */
    public String resolve(String requested) {
        String best = null;
        for (String v : supported) {
            if (compare(v, requested) <= 0) best = v;
        }
        return best;
    }
}
