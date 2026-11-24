package travel.booking;

import java.math.BigDecimal;
import java.util.Optional;

public class BookingPricingService {

    public record Quote(String reference, BigDecimal fare, BigDecimal tax, BigDecimal total, String currency) {}

    public interface LoyaltyLookup {
        Optional<BigDecimal> discountFor(String email);
    }

    private final TaxCalculator taxCalculator;
    private final LoyaltyLookup loyalty;

    public BookingPricingService(TaxCalculator taxCalculator, LoyaltyLookup loyalty) {
        this.taxCalculator = taxCalculator;
        this.loyalty = loyalty;
    }

    public Quote quote(Booking booking) {
        BigDecimal fare = booking.baseFare();

        BigDecimal discount = loyalty.discountFor(booking.passenger().email()).orElse(BigDecimal.ZERO);
        fare = fare.subtract(fare.multiply(discount));

        Booking discounted = new Booking(
                booking.reference(),
                booking.passenger(),
                booking.segments(),
                fare,
                booking.currency());

        BigDecimal tax = taxCalculator.taxFor(discounted);
        return new Quote(booking.reference(), fare, tax, fare.add(tax), booking.currency());
    }
}
