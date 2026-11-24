import { token } from "./container";

export interface RequestContext {
  tenantId: string;
  requestId: string;
}

export interface SearchBackend {
  search(index: string, query: string, limit: number): Promise<Hit[]>;
}

export interface Hit {
  id: string;
  score: number;
}

export interface Metrics {
  timing(name: string, ms: number, tags: Record<string, string>): void;
}

export const RequestContextToken = token<RequestContext>("RequestContext");
export const SearchBackendToken = token<SearchBackend>("SearchBackend");
export const MetricsToken = token<Metrics>("Metrics");
export const QueryServiceToken = token<QueryService>("QueryService");
export const IndexResolverToken = token<IndexResolver>("IndexResolver");

export class IndexResolver {
  constructor(private readonly ctx: RequestContext) {}

  indexFor(collection: string): string {
    return `${this.ctx.tenantId}__${collection}_v3`;
  }
}

export class QueryService {
  constructor(
    private readonly backend: SearchBackend,
    private readonly indexes: IndexResolver,
    private readonly metrics: Metrics,
  ) {}

  async query(collection: string, text: string, limit = 20): Promise<Hit[]> {
    const index = this.indexes.indexFor(collection);
    const started = Date.now();
    try {
      return await this.backend.search(index, text.trim(), Math.min(limit, 100));
    } finally {
      this.metrics.timing("search.query", Date.now() - started, { collection });
    }
  }
}
