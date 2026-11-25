package sessions;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public final class Replica {
    private final String name;
    private final Map<String, Versioned> data = new HashMap<>();
    private boolean up = true;

    public Replica(String name) {
        this.name = name;
    }

    public String name() {
        return name;
    }

    public boolean isUp() {
        return up;
    }

    public void setUp(boolean up) {
        this.up = up;
    }

    public boolean write(String key, Versioned incoming) {
        if (!up) {
            return false;
        }
        Versioned current = data.get(key);
        if (current == null || incoming.version() > current.version()) {
            data.put(key, incoming);
        }
        return true;
    }

    public Optional<Optional<Versioned>> read(String key) {
        if (!up) {
            return Optional.empty();
        }
        return Optional.of(Optional.ofNullable(data.get(key)));
    }
}
