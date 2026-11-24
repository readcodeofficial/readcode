package com.streamly.playback;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class SessionProjection {
    public record SessionState(long lastSeq, long positionMs, boolean playing, boolean ended) { }

    private final Map<String, SessionState> sessions = new ConcurrentHashMap<>();

    public void apply(PlaybackEvent e) {
        sessions.compute(e.sessionId(), (id, current) -> {
            if (current != null && e.seq() <= current.lastSeq()) {
                return current;
            }
            boolean playing = switch (e.type()) {
                case START, RESUME -> true;
                case PAUSE, STOP -> false;
                case SEEK -> current != null && current.playing();
            };
            return new SessionState(e.seq(), e.positionMs(), playing, e.type() == PlaybackEvent.Type.STOP);
        });
    }

    public SessionState get(String sessionId) {
        return sessions.get(sessionId);
    }
}
