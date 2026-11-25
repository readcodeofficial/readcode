package search;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

public class RecencyReranker {

    private static final double HALF_LIFE_DAYS = 14.0;

    private final Clock clock;

    public RecencyReranker(Clock clock) {
        this.clock = clock;
    }

    public SearchResult rerank(SearchResult result) {
        Instant now = clock.instant();
        List<Hit> hits = result.hits();
        hits.sort(Comparator.comparingDouble((Hit h) -> boosted(h, now)).reversed());
        return result;
    }

    private static double boosted(Hit hit, Instant now) {
        double ageDays = Duration.between(hit.publishedAt(), now).toHours() / 24.0;
        return hit.score() * Math.pow(0.5, Math.max(ageDays, 0) / HALF_LIFE_DAYS);
    }
}
