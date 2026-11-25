package streaming;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class StreamSessionServiceTest {

    private static final Instant NOW = Instant.parse("2025-03-01T20:00:00Z");

    @Mock StreamSessionStore store;
    @Mock PlanCatalog plans;

    private StreamSessionService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new StreamSessionService(store, plans, clock, () -> "s-new");
    }

    @Test
    void startsSessionWhenUnderLimit() {
        when(plans.planFor("u1")).thenReturn(new Plan("basic", 2));
        when(store.findByUser("u1")).thenReturn(List.of(session("s-1", "tv", "t9", Duration.ofSeconds(30))));

        StreamSession started = service.start("u1", "t1", "phone");

        assertEquals("s-new", started.id());
        ArgumentCaptor<StreamSession> saved = ArgumentCaptor.forClass(StreamSession.class);
        verify(store).insert(saved.capture());
        assertEquals("phone", saved.getValue().deviceId());
    }

    @Test
    void staleSessionsDoNotCountTowardsLimit() {
        when(plans.planFor("u1")).thenReturn(new Plan("basic", 1));
        when(store.findByUser("u1")).thenReturn(List.of(session("s-old", "tv", "t9", Duration.ofMinutes(10))));

        StreamSession started = service.start("u1", "t1", "phone");

        assertEquals("s-new", started.id());
    }

    @Test
    void rejectsStartWhenPlanLimitReached() {
        when(plans.planFor("u1")).thenReturn(new Plan("basic", 1));
        when(store.findByUser("u1")).thenReturn(List.of(session("s-1", "tv", "t9", Duration.ofSeconds(30))));

        assertThrows(ConcurrentStreamLimitException.class, () -> service.start("u1", "t1", "phone"));

        verify(store, never()).save(any());
    }

    @Test
    void sameDeviceAndTitleResumesWithoutUsingASlot() {
        StreamSession existing = session("s-1", "tv", "t1", Duration.ofSeconds(30));
        when(plans.planFor("u1")).thenReturn(new Plan("basic", 1));
        when(store.findByUser("u1")).thenReturn(List.of(existing));

        StreamSession resumed = service.start("u1", "t1", "tv");

        assertSame(existing, resumed);
        verify(store, never()).insert(any());
    }

    @Test
    void heartbeatStoresCurrentTime() {
        StreamSession old = session("s-1", "tv", "t1", Duration.ofSeconds(90));
        when(store.find("s-1")).thenReturn(Optional.of(old));

        service.heartbeat("s-1");

        ArgumentCaptor<StreamSession> saved = ArgumentCaptor.forClass(StreamSession.class);
        verify(store).save(saved.capture());
        assertEquals(NOW, saved.getValue().lastHeartbeat());
    }

    @Test
    void heartbeatForUnknownSessionFails() {
        when(store.find("missing")).thenReturn(Optional.empty());

        assertThrows(UnknownSessionException.class, () -> service.heartbeat("missing"));
    }

    private static StreamSession session(String id, String device, String title, Duration age) {
        return new StreamSession(id, "u1", title, device, NOW.minus(age));
    }
}
