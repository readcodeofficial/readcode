import { Container } from "./container";
import {
  IndexResolver,
  IndexResolverToken,
  MetricsToken,
  QueryService,
  QueryServiceToken,
  RequestContext,
  RequestContextToken,
  SearchBackend,
  SearchBackendToken,
  Metrics,
} from "./services";

export function buildRoot(backend: SearchBackend, metrics: Metrics): Container {
  return new Container()
    .register(SearchBackendToken, "singleton", () => backend)
    .register(MetricsToken, "singleton", () => metrics)
    .register(IndexResolverToken, "scoped", (c) => new IndexResolver(c.resolve(RequestContextToken)))
    .register(
      QueryServiceToken,
      "singleton",
      (c) =>
        new QueryService(
          c.resolve(SearchBackendToken),
          c.resolve(IndexResolverToken),
          c.resolve(MetricsToken),
        ),
    );
}

export function scopeFor(root: Container, ctx: RequestContext): Container {
  const scope = root.createScope();
  scope.register(RequestContextToken, "scoped", () => ctx);
  return scope;
}

export async function handleSearch(
  root: Container,
  ctx: RequestContext,
  collection: string,
  text: string,
) {
  const scope = scopeFor(root, ctx);
  const service = scope.resolve(QueryServiceToken);
  return service.query(collection, text);
}
