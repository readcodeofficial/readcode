package travel.booking;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record Booking(
        String reference,
        Passenger passenger,
        List<Segment> segments,
        BigDecimal baseFare,
        String currency) {

    public record Passenger(String fullName, String email, Address billingAddress) {}

    public record Address(String line1, String city, String countryCode) {}

    public record Segment(String origin, String destination, LocalDate departure, boolean international) {}

    public boolean hasInternationalSegment() {
        return segments.stream().anyMatch(Segment::international);
    }
}
