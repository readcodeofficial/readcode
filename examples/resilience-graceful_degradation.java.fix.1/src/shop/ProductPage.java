package shop;

import java.util.List;

public record ProductPage(
        Backends.Product product,
        List<String> recommendations,
        List<Backends.Review> reviews,
        List<String> degradedSections) {

    public boolean isDegraded() {
        return !degradedSections.isEmpty();
    }
}
