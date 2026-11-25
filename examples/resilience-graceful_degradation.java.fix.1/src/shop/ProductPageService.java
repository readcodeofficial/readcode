package shop;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;

public final class ProductPageService {
    private final Backends.Products products;
    private final Backends.Recommendations recommendations;
    private final Backends.Reviews reviews;
    private final Duration widgetTimeout;

    public ProductPageService(
            Backends.Products products,
            Backends.Recommendations recommendations,
            Backends.Reviews reviews,
            Duration widgetTimeout) {
        this.products = products;
        this.recommendations = recommendations;
        this.reviews = reviews;
        this.widgetTimeout = widgetTimeout;
    }

    /** The product itself is required; recommendations and reviews are nice to have. */
    public ProductPage load(String productId) {
        List<String> degraded = new CopyOnWriteArrayList<>();

        CompletableFuture<Backends.Product> product = products.fetch(productId);
        CompletableFuture<List<String>> recs = Degrade.optional(
                recommendations.forProduct(productId),
                widgetTimeout,
                List.of(),
                () -> degraded.add("recommendations"));
        CompletableFuture<List<Backends.Review>> revs = Degrade.optional(
                reviews.forProduct(productId),
                widgetTimeout,
                List.of(),
                () -> degraded.add("reviews"));

        return new ProductPage(product.join(), recs.join(), revs.join(), List.copyOf(degraded));
    }
}
