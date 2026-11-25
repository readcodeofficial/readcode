package warehouse;

public final class StockService {
    public static class StaleVersionException extends RuntimeException {
        public StaleVersionException(String sku, long expected) {
            super("stock for " + sku + " is no longer at version " + expected);
        }
    }

    public static class InsufficientStockException extends RuntimeException {
        public InsufficientStockException(String sku, int onHand, int delta) {
            super("cannot apply " + delta + " to " + sku + " with " + onHand + " on hand");
        }
    }

    private final StockRepository repo;

    public StockService(StockRepository repo) {
        this.repo = repo;
    }

    /** Admin screen path: the client says which version it was looking at (If-Match). */
    public StockRecord adjust(String sku, int delta, long ifMatchVersion) {
        StockRecord current = repo.find(sku).orElseThrow(() -> new IllegalArgumentException("unknown sku " + sku));
        int updated = current.onHand() + delta;
        if (updated < 0) {
            throw new InsufficientStockException(sku, current.onHand(), delta);
        }
        return repo.updateIfVersion(current.withOnHand(updated), ifMatchVersion)
                .orElseThrow(() -> new StaleVersionException(sku, ifMatchVersion));
    }

    /** Scanner path: read, modify, and retry if somebody else got in between. */
    public StockRecord adjustWithRetry(String sku, int delta) {
        for (int attempt = 0; attempt < 3; attempt++) {
            StockRecord current = repo.find(sku).orElseThrow(() -> new IllegalArgumentException("unknown sku " + sku));
            int updated = current.onHand() + delta;
            if (updated < 0) {
                throw new InsufficientStockException(sku, current.onHand(), delta);
            }
            var saved = repo.updateIfVersion(current.withOnHand(updated), current.version());
            if (saved.isPresent()) {
                return saved.get();
            }
        }
        throw new StaleVersionException(sku, -1);
    }
}
