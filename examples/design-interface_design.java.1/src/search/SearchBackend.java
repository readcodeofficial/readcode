package search;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

public interface SearchBackend {

    SearchResult search(SearchRequest request);
}

sealed interface Filter permits TermFilter, RangeFilter {}

record TermFilter(String field, String value) implements Filter {}

record RangeFilter(String field, Instant from, Instant to) implements Filter {}

record SearchRequest(String text, Set<Filter> filters, int page, int pageSize) {
    SearchRequest {
        if (text == null || text.isBlank()) {
            throw new IllegalArgumentException("query text is required");
        }
        text = text.strip().toLowerCase();
        filters = Set.copyOf(filters);
        pageSize = Math.min(Math.max(pageSize, 1), 100);
        page = Math.max(page, 0);
    }
}

record Hit(String docId, double score, Instant publishedAt, Map<String, String> fields) {
    Hit {
        fields = Map.copyOf(fields);
    }
}

record SearchResult(String query, List<Hit> hits, long totalHits) {}

class InMemoryBackend implements SearchBackend {

    private final List<Hit> corpus;

    InMemoryBackend(List<Hit> corpus) {
        this.corpus = List.copyOf(corpus);
    }

    @Override
    public SearchResult search(SearchRequest request) {
        List<Hit> matches = new ArrayList<>();
        for (Hit hit : corpus) {
            if (request.filters().stream().allMatch(f -> matches(f, hit))
                    && hit.fields().getOrDefault("title", "").toLowerCase().contains(request.text())) {
                matches.add(hit);
            }
        }
        int from = Math.min(request.page() * request.pageSize(), matches.size());
        int to = Math.min(from + request.pageSize(), matches.size());
        return new SearchResult(request.text(), new ArrayList<>(matches.subList(from, to)), matches.size());
    }

    private static boolean matches(Filter filter, Hit hit) {
        return switch (filter) {
            case TermFilter t -> t.value().equals(hit.fields().get(t.field()));
            case RangeFilter r -> !hit.publishedAt().isBefore(r.from()) && hit.publishedAt().isBefore(r.to());
        };
    }
}
