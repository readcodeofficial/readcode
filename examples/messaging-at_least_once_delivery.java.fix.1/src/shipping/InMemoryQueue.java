package shipping;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/** A tiny broker queue: receive() hands out a message and keeps it in flight until it is acked or nacked. */
public final class InMemoryQueue {
    private final Deque<Delivery> ready = new ArrayDeque<>();
    private final Map<Long, Delivery> inFlight = new HashMap<>();
    private long nextId = 1;

    public synchronized long publish(String body) {
        long id = nextId++;
        ready.addLast(new Delivery(id, body, 1));
        return id;
    }

    public synchronized Delivery receive() {
        Delivery d = ready.pollFirst();
        if (d != null) inFlight.put(d.id(), d);
        return d;
    }

    /** The consumer is finished with the message; it is removed for good. */
    public synchronized void ack(long id) {
        if (inFlight.remove(id) == null) throw new IllegalStateException("not in flight: " + id);
    }

    /** The consumer could not handle the message; it goes back to the queue with a higher attempt number. */
    public synchronized void nack(long id) {
        Delivery d = inFlight.remove(id);
        if (d == null) throw new IllegalStateException("not in flight: " + id);
        ready.addLast(new Delivery(d.id(), d.body(), d.attempt() + 1));
    }

    public synchronized int readyCount() {
        return ready.size();
    }

    public synchronized int inFlightCount() {
        return inFlight.size();
    }
}
