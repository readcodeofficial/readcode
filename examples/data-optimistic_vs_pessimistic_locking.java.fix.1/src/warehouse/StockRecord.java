package warehouse;

/** One row of the stock table. {@code version} is bumped on every successful update. */
public record StockRecord(String sku, int onHand, Long version) {
    public StockRecord withOnHand(int newOnHand) {
        return new StockRecord(sku, newOnHand, version);
    }
}
