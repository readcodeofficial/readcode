package invoicing;

import java.util.List;

public record Invoice(String customer, List<LineItem> items, long netCents, long taxCents) {
    public long totalCents() {
        return netCents + taxCents;
    }
}
