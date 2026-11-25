package search;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;

public class CachingSearchBackend implements SearchBackend {

    private final SearchBackend delegate;
    private final Cache<SearchRequest, SearchResult> cache;

    public CachingSearchBackend(SearchBackend delegate, Duration ttl, long maxEntries) {
        this.delegate = delegate;
        this.cache = Caffeine.newBuilder()
                .expireAfterWrite(ttl)
                .maximumSize(maxEntries)
                .build();
    }

    @Override
    public SearchResult search(SearchRequest request) {
        return cache.get(request, delegate::search);
    }
}
