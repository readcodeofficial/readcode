package search;

public class SearchService {

    private final SearchBackend backend;
    private final RecencyReranker reranker;

    public SearchService(SearchBackend backend, RecencyReranker reranker) {
        this.backend = backend;
        this.reranker = reranker;
    }

    public SearchResult query(SearchRequest request) {
        return reranker.rerank(backend.search(request));
    }
}
