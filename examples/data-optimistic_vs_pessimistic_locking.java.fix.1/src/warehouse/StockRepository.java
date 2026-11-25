package warehouse;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** In-memory stand-in for the stock table. */
public final class StockRepository {
    private final Map<String, StockRecord> rows = new HashMap<>();

    public synchronized void insert(String sku, int onHand, Long version) {
        rows.put(sku, new StockRecord(sku, onHand, version));
    }

    public synchronized Optional<StockRecord> find(String sku) {
        return Optional.ofNullable(rows.get(sku));
    }

    /**
     * Equivalent of {@code UPDATE stock SET on_hand = ?, version = version + 1
     * WHERE sku = ? AND version = ?}. Returns the stored row, or empty if nothing matched.
     */
    public synchronized Optional<StockRecord> updateIfVersion(StockRecord next, Long expectedVersion) {
        StockRecord current = rows.get(next.sku());
        if (current == null || current.version() != expectedVersion) {
            return Optional.empty();
        }
        StockRecord saved = new StockRecord(next.sku(), next.onHand(), current.version() + 1);
        rows.put(saved.sku(), saved);
        return Optional.of(saved);
    }
}
