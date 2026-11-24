package com.wayfare.booking;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

class BookingFlowIT extends PostgresIntegrationTest {

    record CreateBooking(String flightId, String seat, String travelerId) { }

    record BookingView(String id, String status) { }

    @Autowired
    TestRestTemplate http;

    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void seedFlight() {
        jdbc.update("INSERT INTO flights (id, origin, destination, seats) VALUES ('WF100', 'LIS', 'AMS', 180) "
                + "ON CONFLICT (id) DO NOTHING");
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM seat_holds");
        jdbc.update("DELETE FROM bookings");
    }

    @Test
    void createBooking_confirmsAndHoldsTheSeat() {
        ResponseEntity<BookingView> response =
                http.postForEntity("/bookings", new CreateBooking("WF100", "12A", "trav-1"), BookingView.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo("CONFIRMED");

        Integer holds = jdbc.queryForObject(
                "SELECT count(*) FROM seat_holds WHERE flight_id = 'WF100' AND seat = '12A'", Integer.class);
        assertThat(holds).isEqualTo(1);
    }

    @Test
    void createBooking_forTakenSeat_returnsConflict() {
        http.postForEntity("/bookings", new CreateBooking("WF100", "14C", "trav-1"), BookingView.class);

        ResponseEntity<Map> second =
                http.postForEntity("/bookings", new CreateBooking("WF100", "14C", "trav-2"), Map.class);

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void createBooking_enqueuesConfirmationEmail() {
        http.postForEntity("/bookings", new CreateBooking("WF100", "3F", "trav-3"), BookingView.class);

        List<Map<String, Object>> outbox = jdbc.queryForList(
                "SELECT topic, payload FROM outbox_events WHERE topic = 'booking.confirmed'");

        assertThat(outbox).hasSize(1);
        assertThat(outbox.get(0).get("payload").toString()).contains("trav-3");
    }

    @Test
    void cancelBooking_releasesTheSeat() {
        BookingView created = http.postForEntity(
                "/bookings", new CreateBooking("WF100", "20B", "trav-4"), BookingView.class).getBody();
        assertThat(created).isNotNull();

        http.delete("/bookings/{id}", created.id());

        Integer holds = jdbc.queryForObject(
                "SELECT count(*) FROM seat_holds WHERE flight_id = 'WF100' AND seat = '20B'", Integer.class);
        assertThat(holds).isZero();
    }
}
