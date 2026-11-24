package com.shopwave.inventory;

import com.shopwave.inventory.events.OrderPlaced;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InventoryService {

    private final JdbcTemplate jdbc;

    public InventoryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public void reserve(UUID orderId, List<OrderPlaced.Line> lines) {
        for (OrderPlaced.Line line : lines) {
            int updated = jdbc.update(
                    "UPDATE stock SET available = available - ?, reserved = reserved + ? "
                            + "WHERE sku = ? AND available >= ?",
                    line.quantity(), line.quantity(), line.sku(), line.quantity());
            if (updated == 0) {
                throw new InsufficientStockException(line.sku(), line.quantity());
            }
            jdbc.update(
                    "INSERT INTO reservations (order_id, sku, quantity) VALUES (?, ?, ?)",
                    orderId, line.sku(), line.quantity());
        }
    }

    public static class InsufficientStockException extends RuntimeException {
        public InsufficientStockException(String sku, int requested) {
            super("not enough stock for " + sku + " (requested " + requested + ")");
        }
    }
}
