package invoicing;

public final class InvoiceFormatter {
    private InvoiceFormatter() {
    }

    public static String money(long cents) {
        String sign = cents < 0 ? "-" : "";
        long abs = Math.abs(cents);
        return String.format("%s%d.%02d", sign, abs / 100, abs % 100);
    }

    public static String render(Invoice invoice) {
        StringBuilder out = new StringBuilder();
        out.append("Invoice for ").append(invoice.customer()).append('\n');
        for (LineItem item : invoice.items()) {
            out.append(String.format("  %-12s x%-3d %10s [%s]%n",
                    item.description(), item.quantity(), money(item.netCents()), item.region()));
        }
        out.append("  net   ").append(money(invoice.netCents())).append('\n');
        out.append("  tax   ").append(money(invoice.taxCents())).append('\n');
        out.append("  total ").append(money(invoice.totalCents())).append('\n');
        return out.toString();
    }
}
