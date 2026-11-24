package com.streamly.playback;

import java.time.Instant;

public record PlaybackEvent(
        String sessionId,
        String videoId,
        Type type,
        long seq,
        long positionMs,
        Instant occurredAt) {

    public enum Type { START, PAUSE, RESUME, SEEK, STOP }
}
