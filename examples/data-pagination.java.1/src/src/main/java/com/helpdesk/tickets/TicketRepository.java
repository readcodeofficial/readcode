package com.helpdesk.tickets;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import javax.sql.DataSource;

public class TicketRepository {

    static final int DEFAULT_PAGE_SIZE = 25;
    static final int MAX_PAGE_SIZE = 100;

    private final DataSource dataSource;

    public TicketRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public TicketPage listOpenTickets(String queueId, String cursorToken, Integer requestedSize) {
        int pageSize = requestedSize == null
                ? DEFAULT_PAGE_SIZE
                : Math.min(Math.max(requestedSize, 1), MAX_PAGE_SIZE);
        TicketCursor cursor = cursorToken == null ? null : TicketCursor.decode(cursorToken);

        StringBuilder sql = new StringBuilder(
                "SELECT id, subject, status, assignee_id, created_at FROM tickets "
                        + "WHERE queue_id = ? AND status <> 'CLOSED'");
        if (cursor != null) {
            sql.append(" AND created_at < ?");
        }
        sql.append(" ORDER BY created_at DESC, id DESC LIMIT ?");

        List<Ticket> rows = new ArrayList<>(pageSize + 1);
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            int idx = 1;
            ps.setString(idx++, queueId);
            if (cursor != null) {
                ps.setTimestamp(idx++, Timestamp.from(cursor.createdAt()));
            }
            ps.setInt(idx, pageSize + 1);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    rows.add(new Ticket(
                            rs.getLong("id"),
                            rs.getString("subject"),
                            rs.getString("status"),
                            rs.getString("assignee_id"),
                            rs.getTimestamp("created_at").toInstant()));
                }
            }
        } catch (SQLException e) {
            throw new TicketStoreException("failed to list tickets for queue " + queueId, e);
        }

        boolean hasMore = rows.size() > pageSize;
        List<Ticket> items = hasMore ? rows.subList(0, pageSize) : rows;
        String next = null;
        if (hasMore) {
            Ticket last = items.get(items.size() - 1);
            next = new TicketCursor(last.createdAt(), last.id()).encode();
        }
        return new TicketPage(List.copyOf(items), next);
    }
}
