package shop;

import java.util.List;
import java.util.concurrent.CompletableFuture;

public final class Backends {
    private Backends() {}

    public record Product(String id, String name, long priceCents) {}

    public record Review(String author, int stars) {}

    @FunctionalInterface
    public interface Products {
        CompletableFuture<Product> fetch(String productId);
    }

    @FunctionalInterface
    public interface Recommendations {
        CompletableFuture<List<String>> forProduct(String productId);
    }

    @FunctionalInterface
    public interface Reviews {
        CompletableFuture<List<Review>> forProduct(String productId);
    }
}
