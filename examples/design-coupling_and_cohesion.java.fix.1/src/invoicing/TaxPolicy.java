package invoicing;

import java.util.HashMap;
import java.util.Map;

public final class TaxPolicy {
    private static final Map<String, Integer> RATE_CACHE = new HashMap<>();

    private final RateSource source;

    public TaxPolicy(RateSource source) {
        this.source = source;
    }

    public int basisPoints(String region) {
        return RATE_CACHE.computeIfAbsent(region, source::basisPointsFor);
    }

    public long taxCents(String region, long netCents) {
        long numerator = netCents * basisPoints(region);
        return (numerator + 5_000) / 10_000;
    }
}
