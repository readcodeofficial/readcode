package lending.log;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class Logger {

    public enum Level { INFO, WARN, ERROR }

    private final String name;
    private final List<String> sink;

    public Logger(String name, List<String> sink) {
        this.name = name;
        this.sink = sink;
    }

    public static Logger inMemory(String name) {
        return new Logger(name, Collections.synchronizedList(new ArrayList<>()));
    }

    public void info(String message) {
        write(Level.INFO, message);
    }

    public void warn(String message) {
        write(Level.WARN, message);
    }

    public void error(String message) {
        write(Level.ERROR, message);
    }

    public List<String> lines() {
        synchronized (sink) {
            return List.copyOf(sink);
        }
    }

    private void write(Level level, String message) {
        sink.add(level + " [" + name + "] " + message);
    }
}
