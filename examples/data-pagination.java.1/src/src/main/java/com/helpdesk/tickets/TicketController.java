package com.helpdesk.tickets;

import java.util.HashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/queues/{queueId}/tickets")
public class TicketController {

    private final TicketRepository repository;

    public TicketController(TicketRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @PathVariable String queueId,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer limit) {
        TicketPage page = repository.listOpenTickets(queueId, cursor, limit);
        Map<String, Object> body = new HashMap<>();
        body.put("items", page.items());
        body.put("nextCursor", page.nextCursor());
        return ResponseEntity.ok(body);
    }

    @ExceptionHandler(InvalidCursorException.class)
    public ResponseEntity<Map<String, String>> badCursor(InvalidCursorException e) {
        return ResponseEntity.badRequest().body(Map.of("error", "invalid_cursor"));
    }
}
