package travel.booking;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

public class TaxCalculator {

    private static final BigDecimal DEFAULT_RATE = new BigDecimal("0.05");
    private static final BigDecimal INTL_SURCHARGE = new BigDecimal("0.02");

    private final Map<String, BigDecimal> rateByCountry;

    public TaxCalculator(Map<String, BigDecimal> rateByCountry) {
        this.rateByCountry = Map.copyOf(rateByCountry);
    }

    public BigDecimal taxFor(Booking booking) {
        String country = booking.passenger().billingAddress().countryCode();
        BigDecimal rate = rateByCountry.getOrDefault(country, DEFAULT_RATE);
        if (booking.hasInternationalSegment()) {
            rate = rate.add(INTL_SURCHARGE);
        }
        return booking.baseFare().multiply(rate).setScale(2, RoundingMode.HALF_EVEN);
    }
}
