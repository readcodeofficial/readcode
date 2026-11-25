package shipping;

import java.io.IOException;

/** Prints a shipping label for an order id; throws when the printer is unreachable. */
public interface LabelPrinter {
    void print(String orderId) throws IOException;
}
