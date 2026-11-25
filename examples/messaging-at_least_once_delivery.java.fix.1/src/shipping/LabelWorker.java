package shipping;

import java.util.ArrayList;
import java.util.List;

public final class LabelWorker {
    private final InMemoryQueue queue;
    private final LabelPrinter printer;
    private final List<String> failures = new ArrayList<>();

    public LabelWorker(InMemoryQueue queue, LabelPrinter printer) {
        this.queue = queue;
        this.printer = printer;
    }

    /** Handles at most one message. Returns false when the queue had nothing ready. */
    public boolean pollOnce() {
        Delivery d = queue.receive();
        if (d == null) return false;
        try {
            printer.print(d.body());
        } catch (Exception e) {
            failures.add("order " + d.body() + " attempt " + d.attempt() + ": " + e.getMessage());
        } finally {
            queue.ack(d.id());
        }
        return true;
    }

    /** Polls until the queue is empty or the safety limit is hit; returns how many messages were handled. */
    public int drain(int limit) {
        int handled = 0;
        while (handled < limit && pollOnce()) handled++;
        return handled;
    }

    public List<String> failures() {
        return List.copyOf(failures);
    }
}
