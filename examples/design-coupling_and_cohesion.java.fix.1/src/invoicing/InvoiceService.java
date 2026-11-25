package invoicing;

import java.util.ArrayList;
import java.util.List;

public final class InvoiceService {
    private final TaxPolicy taxes;
    private final List<Invoice> issued = new ArrayList<>();

    public InvoiceService(TaxPolicy taxes) {
        this.taxes = taxes;
    }

    public Invoice issue(String customer, List<LineItem> items) {
        if (items.isEmpty()) {
            throw new IllegalArgumentException("invoice needs at least one line");
        }
        long net = 0;
        long tax = 0;
        for (LineItem item : items) {
            net += item.netCents();
            tax += taxes.taxCents(item.region(), item.netCents());
        }
        Invoice invoice = new Invoice(customer, List.copyOf(items), net, tax);
        issued.add(invoice);
        return invoice;
    }

    public java.util.Map<String, Long> taxByRegion() {
        java.util.Map<String, Long> byRegion = new java.util.TreeMap<>();
        for (Invoice invoice : issued) {
            for (LineItem item : invoice.items()) {
                byRegion.merge(item.region(), taxes.taxCents(item.region(), item.netCents()), Long::sum);
            }
        }
        return byRegion;
    }

    public long totalBilled() {
        long sum = 0;
        for (Invoice invoice : issued) {
            sum += invoice.totalCents();
        }
        return sum;
    }
}
