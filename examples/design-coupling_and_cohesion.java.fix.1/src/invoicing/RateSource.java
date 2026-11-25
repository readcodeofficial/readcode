package invoicing;

public interface RateSource {
    int basisPointsFor(String region);
}
