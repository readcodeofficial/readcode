package com.sensorgrid.ingest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TelemetryIngestServiceTest {

    private static final Instant NOW = Instant.parse("2025-03-01T12:00:00Z");

    @Mock
    private DeviceRegistry registry;

    @Mock
    private AlertPublisher alerts;

    private final InMemoryReadingStore store = new InMemoryReadingStore();
    private TelemetryIngestService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new TelemetryIngestService(registry, store, alerts, clock);
    }

    private void givenDevice(String id, double threshold) {
        when(registry.find(id)).thenReturn(Optional.of(new DeviceProfile(id, threshold)));
    }

    @Test
    void unknownDeviceIsRejectedWithoutStoringOrAlerting() {
        when(registry.find("ghost")).thenReturn(Optional.empty());

        IngestResult result = service.ingest(new Reading("ghost", 900, NOW));

        assertThat(result).isEqualTo(IngestResult.UNKNOWN_DEVICE);
        assertThat(store.latest("ghost")).isEmpty();
        verifyNoInteractions(alerts);
    }

    @Test
    void readingAboveThresholdPublishesAlertCarryingTheDeviceThreshold() {
        givenDevice("pump-7", 80.0);
        Reading reading = new Reading("pump-7", 93.5, NOW.minusSeconds(30));

        IngestResult result = service.ingest(reading);

        assertThat(result).isEqualTo(IngestResult.ALERTED);
        ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
        verify(alerts).publish(captor.capture());
        assertThat(captor.getValue().threshold()).isEqualTo(80.0);
        assertThat(captor.getValue().value()).isEqualTo(93.5);
        assertThat(store.latest("pump-7")).contains(reading);
    }

    @Test
    void readingBelowThresholdIsStoredQuietly() {
        givenDevice("pump-7", 80.0);
        Reading reading = new Reading("pump-7", 41.0, NOW);

        assertThat(service.ingest(reading)).isEqualTo(IngestResult.STORED);

        assertThat(store.latest("pump-7")).contains(reading);
        verifyNoInteractions(alerts);
    }

    @Test
    void olderReadingNeitherReplacesNewerOneNorAlerts() {
        givenDevice("pump-7", 80.0);
        Reading newer = new Reading("pump-7", 50.0, NOW.minusSeconds(10));
        Reading older = new Reading("pump-7", 99.0, NOW.minusSeconds(60));

        service.ingest(newer);
        IngestResult result = service.ingest(older);

        assertThat(result).isEqualTo(IngestResult.STALE);
        assertThat(store.latest("pump-7")).contains(newer);
        verifyNoInteractions(alerts);
    }

    @Test
    void readingFromFarInTheFutureIsRejected() {
        givenDevice("pump-7", 80.0);

        IngestResult result = service.ingest(new Reading("pump-7", 10.0, NOW.plusSeconds(3600)));

        assertThat(result).isEqualTo(IngestResult.REJECTED_FUTURE);
        assertThat(store.latest("pump-7")).isEmpty();
    }
}
