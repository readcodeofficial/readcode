package invoicing;

public record LineItem(String description, int quantity, long unitCents, String region) {
    public long netCents() {
        return quantity * unitCents;
    }
}
