package com.gatekeep.audit;

import java.time.Instant;

public record LoginEvent(String eventId, String userId, String ip, boolean success, Instant at) {
}
