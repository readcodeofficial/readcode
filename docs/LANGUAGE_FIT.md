# Language fit per topic

Which languages suit an exercise on each taxonomy topic, in backend work. Planning (`planFromClassification` in
`pipeline/src/pipeline.ts`) only gives a topic the posting's languages with fit ≥ 0.7 (common or mainstream), weighting each by
posting language weight × fit; if none fits, the topic uses its best-fitting language.

Generated from `pipeline/taxonomy/language_fit.json` by `pipeline/src/languageFitDoc.ts` — edit the JSON, then regenerate.

**Scale:** 1 = a mainstream home of the topic (routine, well-known libraries/runtime features/bug classes) ·
.7 = common · .4 = plausible but not where most people meet it · .1 = rare, would look contrived · · = doesn't arise.

**Evidence:** each topic lists web sources (library/framework docs, language references, engineering articles) and
the corpus lift from our 76 classified postings that name languages (`docs/language_lift.json`,
`pipeline/src/languageLift.ts`): how much more (>1) or less (<1) often a language co-occurs with the topic than
its baseline share. Lift is sparse for C#, PHP, C, Scala and Kotlin, so the web evidence sets the scores and lift
is a cross-check.

## concurrency

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| race_conditions | .4 | .4 | **1** | .7 | **1** | .7 | .7 | .4 | .7 | **1** | **1** | .7 | .4 |
| locking_and_lock_ordering | .4 | .4 | **1** | .7 | **1** | .7 | .7 | .4 | .7 | **1** | **1** | .4 | .4 |
| deadlocks | .4 | .4 | **1** | .7 | **1** | .7 | **1** | .4 | .7 | **1** | **1** | .7 | .4 |
| thread_and_worker_pools | .4 | .4 | **1** | .7 | .7 | **1** | **1** | .7 | .7 | .4 | .7 | .7 | .4 |
| async_await_pitfalls | **1** | **1** | .4 | .7 | .1 | **1** | **1** | .1 | **1** | · | .1 | .7 | .1 |
| atomic_operations | .1 | .1 | **1** | .7 | **1** | .1 | .7 | .1 | **1** | **1** | **1** | .4 | · |
| shared_state_in_request_handlers | .7 | .7 | **1** | .7 | **1** | .7 | **1** | .7 | .4 | .1 | .4 | .4 | .4 |

### race_conditions

Shared-memory multithreading makes data races a routine bug class in Java, Go, C and C++, which have formal memory models and race detectors (JMM, go race detector, TSan). Rust prevents data races at compile time, so only logic races remain. Single-threaded Node and shared-nothing PHP mostly see check-then-act races across awaits or concurrent requests hitting the database, so they sit at 0.4.

- <https://go.dev/doc/articles/race_detector> — Go ships a built-in race detector because data races are a common Go bug
- <https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html> — Java memory model defines data races and happens-before for threaded code
- <https://clang.llvm.org/docs/ThreadSanitizer.html> — ThreadSanitizer detects data races in C/C++ programs
- <https://doc.rust-lang.org/nomicon/races.html> — Safe Rust prevents data races but not general race conditions
- <https://blog.theodo.com/2019/09/handle-race-conditions-in-nodejs-using-mutex> — Node.js still has async interleaving races despite being single-threaded
- Corpus lift: C++ ×1.31 (topic mass 29.17)

### locking_and_lock_ordering

Explicit mutexes and lock-ordering rules are everyday material in Java (synchronized/ReentrantLock), Go (sync.Mutex), C (pthreads) and C++ (std::lock, Abseil), with CERT rules on lock order for C and Java. Rust, C#, Kotlin and Python have first-class locks too. Scala idioms (actors, Ref) avoid locks. In JS/TS, Ruby and PHP, locking mostly means DB row locks or Redis/cache locks.

- <https://wiki.sei.cmu.edu/confluence/display/c/CON35-C.+Avoid+deadlock+by+locking+in+a+predefined+order> — CERT C rule: lock in a predefined order
- <https://wiki.sei.cmu.edu/confluence/display/java/LCK07-J.+Avoid+deadlock+by+requesting+and+releasing+locks+in+the+same+order> — CERT Java rule on consistent lock ordering
- <https://en.cppreference.com/w/cpp/thread/lock> — C++ std::lock acquires multiple mutexes with deadlock avoidance
- <https://pkg.go.dev/sync> — Go sync.Mutex/RWMutex are core primitives
- <https://www.postgresql.org/docs/current/explicit-locking.html> — DB row/advisory locks, the locking form most relevant to JS/Ruby/PHP backends
- Corpus lift: C++ ×1.49, PHP ×1.45 (topic mass 19.64)

### deadlocks

Lock-order deadlocks are canonical in Java, C and C++. Go has channel/goroutine deadlocks ('all goroutines are asleep'). C# has the well-known sync-over-async (.Result/.Wait) deadlock. Kotlin (runBlocking), Scala (blocking Await on a bounded pool) and Python (threading, asyncio) have their own variants. In JS/TS, Ruby and PHP, deadlocks mostly appear as database transaction deadlocks.

- <https://learn.microsoft.com/en-us/archive/msdn-magazine/2013/march/async-await-best-practices-in-asynchronous-programming> — Canonical C# deadlock from blocking on async code
- <https://wiki.sei.cmu.edu/confluence/display/java/LCK07-J.+Avoid+deadlock+by+requesting+and+releasing+locks+in+the+same+order> — Java lock-order deadlocks
- <https://go.dev/ref/mem> — Go memory model for channels/mutexes, where goroutine deadlocks arise
- <https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html> — DB deadlocks and retry/lock-order guidance, applicable to any language including PHP/Node/Ruby
- Corpus lift: C++ ×1.55, PHP ×1.46, C ×1.4 (topic mass 13.97)

### thread_and_worker_pools

Java (ThreadPoolExecutor), C# (ThreadPool starvation) and Python (concurrent.futures, gunicorn/Celery workers) are mainstream homes of pool sizing and queueing bugs. Go worker pools, Ruby Puma/Sidekiq concurrency, tokio spawn_blocking, Kotlin dispatchers and Scala ExecutionContexts are common. Node's worker_threads/libuv pool and PHP-FPM pm settings are plausible but less code-level.

- <https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html> — Java thread pool sizing, queues and rejection policies
- <https://learn.microsoft.com/en-us/dotnet/standard/threading/the-managed-thread-pool> — .NET managed thread pool
- <https://docs.python.org/3/library/concurrent.futures.html> — Python ThreadPoolExecutor/ProcessPoolExecutor
- <https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html> — tokio blocking thread pool
- <https://nodejs.org/api/worker_threads.html> — Node worker threads, an opt-in mechanism
- <https://www.php.net/manual/en/install.fpm.configuration.php> — PHP-FPM process pool settings (pm.max_children), config rather than code
- Corpus lift: PHP ×1.49, C++ ×1.45 (topic mass 24.58)

### async_await_pitfalls

async/await is native and pervasive in TS/JS, Python (asyncio), C# and Rust (tokio), each with canonical pitfalls: floating promises, blocking the event loop, async void, holding locks across await. Kotlin coroutines and Scala Futures are close equivalents. Java has only CompletableFuture (and virtual threads), Go uses goroutines instead of async/await, Ruby and PHP async ecosystems (async gem, Fibers/ReactPHP) are niche, and C has nothing comparable.

- <https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop> — Node event-loop blocking pitfalls
- <https://docs.python.org/3/library/asyncio-dev.html> — asyncio pitfalls: blocking calls, never-awaited coroutines
- <https://learn.microsoft.com/en-us/archive/msdn-magazine/2013/march/async-await-best-practices-in-asynchronous-programming> — C# async void and sync-over-async pitfalls
- <https://tokio.rs/tokio/tutorial/shared-state> — tokio guidance on holding mutexes across .await
- <https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/CompletableFuture.html> — Java uses futures, not async/await
- <https://www.php.net/manual/en/language.fibers.php> — PHP has only low-level Fibers, no async/await
- Corpus lift: Rust ×1.39, JavaScript ×1.37, TypeScript ×1.34 (topic mass 21.11)

### atomic_operations

Atomics with memory orderings are first-class in C11, C++ std::atomic, Rust std::sync::atomic, Go sync/atomic and java.util.concurrent.atomic. C# has Interlocked and Kotlin has JVM atomics. Scala usually wraps them (AtomicReference, cats-effect Ref). Python and Ruby have no userland atomics, JS Atomics only apply to SharedArrayBuffer, and PHP has none.

- <https://en.cppreference.com/w/cpp/atomic/memory_order> — C++ memory orderings for atomics
- <https://en.cppreference.com/w/c/atomic> — C11 atomics
- <https://doc.rust-lang.org/std/sync/atomic/index.html> — Rust atomic types
- <https://pkg.go.dev/sync/atomic> — Go sync/atomic
- <https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/atomic/package-summary.html> — Java atomic package
- <https://learn.microsoft.com/en-us/dotnet/api/system.threading.interlocked> — C# Interlocked operations
- Corpus lift: C++ ×1.56, PHP ×1.41 (topic mass 20.19)

### shared_state_in_request_handlers

Mutable fields on singleton Spring beans, ASP.NET singleton services capturing scoped state, and Go handlers running concurrently on one goroutine per request are classic bugs. Node module-level state leaks across requests, and Rails/Puma and Python module globals are common too. Rust forces Arc<Mutex> so only logic bugs remain, C/C++ are rarely written as request handlers, and PHP-FPM is shared-nothing (only Octane/Swoole worker mode reintroduces it).

- <https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html> — Spring beans are singletons by default, shared across requests
- <https://pkg.go.dev/net/http> — Go Server serves each connection in its own goroutine
- <https://learn.microsoft.com/en-us/aspnet/core/fundamentals/dependency-injection> — ASP.NET Core singleton vs scoped lifetimes and captive dependencies
- <https://guides.rubyonrails.org/threading_and_code_execution.html> — Rails threading and shared state concerns
- <https://laravel.com/docs/11.x/octane> — Octane keeps the app in memory, so state leaks between requests (unlike FPM)
- <https://tideways.com/profiler/blog/php-shared-nothing-architecture-the-benefits-and-downsides> — PHP's shared-nothing request model
- Corpus lift: no language above ×1.3 (topic mass 16.98)

## resilience

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| timeouts | **1** | **1** | **1** | .7 | **1** | **1** | **1** | .7 | .7 | .4 | .7 | .7 | .7 |
| retries_and_backoff | .7 | .7 | **1** | .7 | **1** | **1** | **1** | .7 | .7 | .1 | .4 | .7 | .7 |
| circuit_breakers | .7 | .7 | **1** | .7 | .7 | .4 | **1** | .4 | .4 | .1 | .4 | .7 | .1 |
| rate_limiting | .7 | .7 | **1** | .4 | **1** | .7 | .7 | .7 | .7 | .4 | .4 | .4 | .7 |
| graceful_degradation | .7 | .7 | **1** | .7 | .7 | .7 | .7 | .7 | .4 | .4 | .4 | .7 | .4 |
| graceful_shutdown | .7 | .7 | **1** | .7 | **1** | .7 | .7 | .7 | .7 | .4 | .4 | .4 | .4 |

### timeouts

Missing or mis-propagated timeouts are a universal backend bug. Several languages have canonical forms: Go context deadlines, Python requests having no default timeout, fetch/AbortSignal.timeout in Node, HttpClient/CancellationToken in C#, Java HTTP/JDBC clients. C++ infrastructure (gRPC, Envoy) deals with deadlines constantly. Plain C service code is less common.

- <https://pkg.go.dev/context> — Go context deadlines and cancellation
- <https://requests.readthedocs.io/en/latest/user/advanced/#timeouts> — Python requests does not time out unless a timeout is set
- <https://nodejs.org/api/globals.html#abortsignaltimeoutdelay> — Node AbortSignal.timeout for fetch
- <https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/> — AWS on timeouts as a core resilience mechanism
- <https://docs.guzzlephp.org/en/stable/request-options.html#timeout> — PHP Guzzle timeout options (default 0 = wait indefinitely)
- Corpus lift: C# ×1.3 (topic mass 32.47)

### retries_and_backoff

Well-known retry libraries define the 1.0s: resilience4j/Failsafe (Java), Polly and Microsoft.Extensions.Http.Resilience (C#), cenkalti/backoff (Go), tenacity (Python). Node (p-retry), Ruby (retriable, Sidekiq retries), Rust (backoff, tower), Scala (ZIO Schedule) and PHP (Laravel retry/queue backoff) have common support. C rarely hosts this logic, and in C++ it lives mostly in gRPC internals.

- <https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/> — Retries, exponential backoff and jitter
- <https://github.com/App-vNext/Polly> — .NET resilience library with retry policies
- <https://github.com/jd/tenacity> — Python retry library
- <https://github.com/cenkalti/backoff> — Go exponential backoff library
- <https://github.com/failsafe-lib/failsafe> — Java retry/fallback library
- <https://github.com/grpc/grpc/blob/master/doc/connection-backoff.md> — gRPC connection backoff spec, implemented in C++ core
- Corpus lift: no language above ×1.3 (topic mass 33.07)

### circuit_breakers

The pattern was popularized in the JVM world (Netflix Hystrix, resilience4j) and .NET (Polly). It is common in Go (sony/gobreaker), Node (opossum) and Scala (Akka/Pekko CircuitBreaker). Python and Ruby (Semian) libraries exist but are less central, Rust and C++ meet it mostly in proxies like Envoy, and PHP's shared-nothing model makes in-process breaker state awkward.

- <https://martinfowler.com/bliki/CircuitBreaker.html> — Defines the circuit breaker pattern
- <https://resilience4j.readme.io/docs/circuitbreaker> — Java resilience4j circuit breaker
- <https://github.com/Netflix/Hystrix> — Netflix Hystrix (Java)
- <https://github.com/sony/gobreaker> — Go circuit breaker library
- <https://github.com/nodeshift/opossum> — Node.js circuit breaker
- <https://pekko.apache.org/docs/pekko/current/common/circuitbreaker.html> — Scala Pekko circuit breaker
- <https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/upstream/circuit_breaking> — Circuit breaking in a C++ proxy
- Corpus lift: PHP ×1.5 (topic mass 18.95)

### rate_limiting

Token-bucket limiters are standard library or framework level in Go (x/time/rate) and Java (resilience4j, Guava, Bucket4j). Framework middleware makes it common in ASP.NET Core, Laravel/Symfony, rack-attack, express-rate-limit, slowapi and tower. In C/C++ it mostly lives in proxies (nginx limit_req), and Kotlin/Scala usually reuse JVM libraries.

- <https://pkg.go.dev/golang.org/x/time/rate> — Go token-bucket rate limiter
- <https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit> — ASP.NET Core rate limiting middleware
- <https://laravel.com/docs/11.x/rate-limiting> — Laravel rate limiter
- <https://github.com/rack/rack-attack> — Ruby Rack rate limiting middleware
- <https://nginx.org/en/docs/http/ngx_http_limit_req_module.html> — nginx (C) leaky-bucket request limiting
- Corpus lift: C# ×1.58 (topic mass 22.86)

### graceful_degradation

Fallbacks and load shedding are architectural and fairly language-neutral. Java is highest because Hystrix fallbacks and Netflix concurrency-limits made it the canonical home. Most service languages are common settings (Polly fallbacks, Semian in Ruby). Rust/C/C++ meet it mainly in infrastructure load shedding, and PHP apps rarely implement it in code.

- <https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/> — Load shedding and degradation under overload
- <https://sre.google/sre-book/handling-overload/> — Google SRE: graceful degradation and handling overload
- <https://github.com/netflix/hystrix/wiki/how-it-works> — Hystrix fallback execution (Java)
- <https://github.com/Netflix/concurrency-limits> — Java adaptive concurrency limiting / load shedding
- <https://github.com/Shopify/semian> — Ruby resiliency toolkit (bulkheads, circuit breakers)
- Corpus lift: PHP ×1.77, C# ×1.49 (topic mass 22.97)

### graceful_shutdown

Go (http.Server.Shutdown, signal.NotifyContext) and Spring Boot (server.shutdown=graceful) are the canonical homes. Node server.close plus SIGTERM, Gunicorn/Puma/Sidekiq signals, .NET generic host stop and tokio signal handling are common. C/C++ daemons handle signals but less as an exercise pattern, Scala relies on effect-system resource finalizers, and PHP mostly delegates to FPM apart from long-running queue workers.

- <https://pkg.go.dev/net/http#Server.Shutdown> — Go graceful HTTP server shutdown
- <https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html> — Spring Boot graceful shutdown
- <https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/> — SIGTERM and grace period during pod termination
- <https://github.com/sidekiq/sidekiq/wiki/Signals> — Sidekiq (Ruby) graceful shutdown signals
- <https://gunicorn.org/signals/> — Gunicorn (Python) graceful TERM handling
- <https://nodejs.org/api/http.html#serverclosecallback> — Node server.close stops accepting new connections
- Corpus lift: PHP ×2.29 (topic mass 16.03)

## data

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| transactions_and_isolation_levels | .7 | .7 | **1** | .7 | **1** | **1** | **1** | .7 | .7 | .4 | .7 | .7 | .7 |
| n_plus_one_queries | **1** | .7 | **1** | .7 | .7 | **1** | **1** | **1** | .4 | .1 | .1 | .4 | **1** |
| connection_pooling | .7 | .7 | **1** | .7 | **1** | **1** | .7 | .7 | .7 | .7 | .4 | .7 | .4 |
| migrations | **1** | .7 | **1** | .7 | .7 | **1** | **1** | **1** | .4 | .1 | .1 | .4 | **1** |
| orm_pitfalls | **1** | .7 | **1** | .7 | .4 | **1** | **1** | **1** | .4 | · | .1 | .4 | **1** |
| pagination | **1** | .7 | **1** | .7 | .7 | **1** | .7 | **1** | .7 | .1 | .4 | .4 | **1** |
| optimistic_vs_pessimistic_locking | .7 | .4 | **1** | .7 | .7 | .7 | **1** | **1** | .4 | .1 | .4 | .4 | .7 |
| nosql_modeling | **1** | **1** | .7 | .4 | .7 | .7 | .7 | .4 | .4 | .1 | .1 | .4 | .4 |
| money_and_ledgers | .7 | .7 | **1** | .7 | .7 | **1** | **1** | **1** | .4 | .1 | .4 | .7 | .7 |

### transactions_and_isolation_levels

Every language with a mainstream SQL stack exposes transaction boundaries and isolation levels (Spring @Transactional, Django atomic, EF Core, Go database/sql TxOptions), so the app-side bugs (wrong scope, lost updates under READ COMMITTED) appear everywhere; Java/Go/Python/C# are highest because the isolation knob is explicit and heavily discussed. C++ (RocksDB, many storage engines) and C (PostgreSQL's MVCC itself) count for infrastructure, but C exercises would be engine-internals only.

- <https://www.postgresql.org/docs/current/transaction-iso.html> — Language-neutral definition of isolation levels and anomalies; PostgreSQL's MVCC is implemented in C.
- <https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html> — Java/Kotlin: @Transactional with isolation and propagation settings, a routine source of scoping bugs.
- <https://docs.djangoproject.com/en/stable/topics/db/transactions/> — Python: Django atomic blocks and autocommit semantics.
- <https://learn.microsoft.com/en-us/ef/core/saving/transactions> — C#: EF Core explicit transactions and isolation levels.
- <https://pkg.go.dev/database/sql#TxOptions> — Go: database/sql exposes isolation level per transaction.
- <https://github.com/facebook/rocksdb/wiki/Transactions> — C++: transaction and snapshot semantics inside a storage engine.
- Corpus lift: no language above ×1.3 (topic mass 28.82)

### n_plus_one_queries

N+1 comes from lazy-loading ORMs and GraphQL resolvers: ActiveRecord (Bullet gem exists just for it), Django, Hibernate, EF Core, Eloquent and Prisma/DataLoader all document eager loading as the fix. Go (GORM Preload) and Kotlin/JS are common but less ORM-centric; Rust and Scala data access is mostly explicit SQL, and C/C++ backends rarely have an ORM layer.

- <https://guides.rubyonrails.org/active_record_querying.html> — Ruby: Rails guide section on eager loading (includes/preload) to solve N+1.
- <https://github.com/flyerhzm/bullet> — Ruby: a widely used gem dedicated to detecting N+1 queries.
- <https://vladmihalcea.com/n-plus-1-query-problem/> — Java: N+1 with JPA/Hibernate lazy associations.
- <https://docs.djangoproject.com/en/stable/ref/models/querysets/> — Python: select_related/prefetch_related.
- <https://learn.microsoft.com/en-us/ef/core/querying/related-data/> — C#: EF Core eager, explicit and lazy loading.
- <https://laravel.com/docs/eloquent-relationships> — PHP: Eloquent eager loading and preventing lazy loading.
- <https://github.com/graphql/dataloader> — JS/TS: DataLoader batching built to fix N+1 in GraphQL resolvers.
- <https://gorm.io/docs/preload.html> — Go: GORM Preload for associations.
- Corpus lift: Ruby ×2.18 (topic mass 21.52)

### connection_pooling

HikariCP (Java/JVM), Go's built-in database/sql pool and SQLAlchemy's pool are where engineers routinely tune sizes and chase leaks/exhaustion; node-postgres, ADO.NET, Rails and sqlx pools are common too. C scores 0.7 because PgBouncer-style poolers are C infrastructure; classic PHP-FPM is request-scoped with only persistent connections, so pooling bugs are less typical there.

- <https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing> — Java: canonical pool-sizing article from HikariCP.
- <https://go.dev/doc/database/manage-connections> — Go: database/sql has a built-in pool with SetMaxOpenConns etc.
- <https://docs.sqlalchemy.org/en/20/core/pooling.html> — Python: SQLAlchemy pool configuration, overflow, pre-ping.
- <https://node-postgres.com/apis/pool> — JS/TS: pg Pool, client release semantics.
- <https://www.pgbouncer.org/> — C: PgBouncer, a widely used connection pooler written in C.
- <https://www.php.net/manual/en/pdo.connections.php> — PHP: only persistent connections, no in-process pool in the standard model.
- <https://docs.rs/sqlx/latest/sqlx/pool/index.html> — Rust: sqlx connection pool.
- Corpus lift: PHP ×1.78 (topic mass 20.57)

### migrations

Schema migrations are a first-class framework feature in Rails, Django/Alembic, EF Core, Laravel and Prisma, and Flyway/Liquibase are standard on the JVM; strong_migrations shows the unsafe-migration bug class is well catalogued. Go uses standalone tools (golang-migrate), Rust/Scala have thinner tooling, and C/C++ services rarely own migration code.

- <https://guides.rubyonrails.org/active_record_migrations.html> — Ruby: Rails migrations.
- <https://github.com/ankane/strong_migrations> — Ruby: catalogue of unsafe migration patterns (locking, backfills).
- <https://docs.djangoproject.com/en/stable/topics/migrations/> — Python: Django migrations.
- <https://documentation.red-gate.com/fd> — Java: Flyway migration tool.
- <https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/> — C#: EF Core migrations.
- <https://laravel.com/docs/migrations> — PHP: Laravel migrations.
- <https://www.prisma.io/docs/orm/prisma-migrate> — TypeScript: Prisma Migrate.
- <https://github.com/golang-migrate/migrate> — Go: standalone migration tool rather than a framework feature.
- Corpus lift: Ruby ×1.59 (topic mass 23.41)

### orm_pitfalls

Needs a mainstream ORM: Hibernate/JPA, ActiveRecord, Django ORM/SQLAlchemy, EF Core, Eloquent and Prisma/TypeORM all have well-known pitfalls (lazy loading, dirty checking, detached entities). Go culture prefers explicit SQL despite GORM, Rust has Diesel/SeaORM and Scala has Slick, but with thinner ecosystems; C has essentially no ORM ecosystem.

- <https://docs.jboss.org/hibernate/orm/current/userguide/html_single/Hibernate_User_Guide.html> — Java: Hibernate fetching, flushing and persistence-context semantics.
- <https://learn.microsoft.com/en-us/ef/core/querying/related-data/> — C#: EF Core lazy loading behaviour.
- <https://docs.djangoproject.com/en/stable/ref/models/querysets/> — Python: lazy QuerySet evaluation.
- <https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance> — TypeScript: Prisma's documented performance pitfalls.
- <https://gorm.io/docs/preload.html> — Go: GORM exists, but is one option among plain-SQL approaches.
- Corpus lift: Ruby ×2.43 (topic mass 18.54)

### pagination

Offset vs keyset/cursor pagination bugs appear in every API stack; Django REST Framework, Spring Data Pageable, Laravel's paginator and Rails pagination gems make it routine in Python/Java/PHP/Ruby, and TS dominates GraphQL cursor APIs. C++ scores 0.4 for scan/iterator cursors in storage engines; C API code is rare.

- <https://use-the-index-luke.com/no-offset> — Language-neutral: why OFFSET pagination is slow/unstable and keyset is preferred.
- <https://docs.stripe.com/api/pagination> — Cursor-based pagination as used by a major public API.
- <https://www.django-rest-framework.org/api-guide/pagination/> — Python: DRF page-number, limit-offset and cursor pagination.
- <https://laravel.com/docs/pagination> — PHP: Laravel paginate, simplePaginate and cursorPaginate.
- Corpus lift: TypeScript ×1.32 (topic mass 22.7)

### optimistic_vs_pessimistic_locking

JPA @Version/LockModeType, EF Core concurrency tokens and Rails lock_version give Java, C# and Ruby first-class built-in support; Django select_for_update and Laravel lockForUpdate make it common in Python/PHP. Go does it with version columns or conditional writes by hand; C++ appears via storage engines (RocksDB OptimisticTransactionDB).

- <https://docs.jboss.org/hibernate/orm/current/userguide/html_single/Hibernate_User_Guide.html> — Java: Hibernate optimistic (@Version) and pessimistic (PESSIMISTIC_WRITE) locking.
- <https://learn.microsoft.com/en-us/ef/core/saving/concurrency> — C#: EF Core optimistic concurrency tokens.
- <https://api.rubyonrails.org/classes/ActiveRecord/Locking/Optimistic.html> — Ruby: ActiveRecord lock_version optimistic locking.
- <https://laravel.com/docs/queries> — PHP: sharedLock/lockForUpdate pessimistic locking.
- <https://github.com/facebook/rocksdb/wiki/Transactions> — C++: RocksDB pessimistic TransactionDB vs OptimisticTransactionDB.
- Corpus lift: no language above ×1.3 (topic mass 17.69)

### nosql_modeling

Document and single-table modeling is most at home in Node/TS (Mongoose, ElectroDB for DynamoDB), with Java (Spring Data MongoDB, DynamoDB Enhanced Client), Python (boto3/pymongo), Go and C# (Cosmos DB) common. Ruby/PHP stacks lean on relational ORMs; C/C++ only appear as the database engine, not as data-model code.

- <https://mongoosejs.com/docs/guide.html> — JS/TS: Mongoose schemas.
- <https://electrodb.dev/> — TS: DynamoDB single-table modeling library.
- <https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html> — NoSQL access-pattern-first design.
- <https://www.mongodb.com/docs/manual/data-modeling/> — Embedding vs referencing.
- <https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/modeling-data> — C#/.NET ecosystem: Cosmos DB data modeling.
- Corpus lift: Java ×1.34 (topic mass 16.23)

### money_and_ledgers

Java (BigDecimal, JSR 354/Moneta), C# (built-in decimal), Python (decimal) and Ruby (BigDecimal plus the money gem) have first-class decimal money types and many fintech codebases. JS/TS make the float-rounding bug canonical but need Dinero.js-style libraries; Go uses shopspring/decimal; Rust has rust_decimal; C++ appears in trading (fixed-point); C rarely.

- <https://github.com/JavaMoney/jsr354-ri> — Java: JSR 354 Money and Currency reference implementation.
- <https://learn.microsoft.com/en-us/dotnet/api/system.decimal> — C#: built-in decimal type.
- <https://docs.python.org/3/library/decimal.html> — Python: decimal module with rounding control.
- <https://github.com/RubyMoney/money> — Ruby: money gem.
- <https://github.com/dinerojs/dinero.js> — JS/TS: immutable money library to avoid float errors.
- <https://github.com/shopspring/decimal> — Go: arbitrary-precision decimal (no built-in type).
- <https://github.com/moneyphp/money> — PHP: Money pattern implementation.
- <https://github.com/paupino/rust-decimal> — Rust: decimal crate.
- Corpus lift: Go ×1.54 (topic mass 9.36)

## caching

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| cache_invalidation | .7 | .7 | **1** | .7 | .7 | .7 | .7 | **1** | .4 | .4 | .4 | .4 | .7 |
| ttls_and_expiry | .7 | .7 | **1** | .7 | .7 | .7 | **1** | .7 | .7 | .7 | .4 | .4 | .7 |
| cache_stampedes | .4 | .4 | .7 | .4 | **1** | .7 | **1** | .7 | .7 | .7 | .4 | .4 | .7 |
| cache_aside_vs_write_through | .7 | .7 | **1** | .7 | .7 | .7 | .7 | .7 | .4 | .1 | .4 | .4 | .7 |
| stale_reads | .7 | .7 | **1** | .7 | **1** | .7 | .7 | .7 | .7 | .4 | .7 | .7 | .7 |

### cache_invalidation

Spring's @CacheEvict/@CachePut and Rails' key-based (Russian-doll) caching make invalidation a framework-level concern in Java and Ruby; every web stack has Redis/memcached clients so it is common elsewhere. C/C++ appear through caches and proxies themselves (memcached, Varnish), which is plausible but narrower.

- <https://docs.spring.io/spring-framework/reference/integration/cache/annotations.html> — Java: @Cacheable/@CacheEvict/@CachePut annotations.
- <https://guides.rubyonrails.org/caching_with_rails.html> — Ruby: fragment/Russian-doll caching with key-based expiration.
- <https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala> — Scaling Memcache at Facebook: invalidation and consistency at scale (C++ infra).
- <https://learn.microsoft.com/en-us/aspnet/core/performance/caching/memory> — C#: IMemoryCache eviction and change tokens.
- Corpus lift: PHP ×1.3 (topic mass 25.03)

### ttls_and_expiry

Caffeine (expireAfterWrite/expireAfterAccess) and .NET MemoryCache (absolute vs sliding expiration) put TTL semantics directly in application code; Rust's moka and the usual Redis TTLs make it common elsewhere. C is 0.7 because Redis and memcached implement expiry in C.

- <https://github.com/ben-manes/caffeine/wiki/Eviction> — Java: Caffeine time-based expiration policies.
- <https://learn.microsoft.com/en-us/aspnet/core/performance/caching/memory> — C#: absolute and sliding expiration in IMemoryCache.
- <https://redis.io/docs/latest/commands/expire/> — Redis EXPIRE semantics, including passive and active expiry (Redis is C).
- <https://github.com/moka-rs/moka> — Rust: moka cache with time_to_live/time_to_idle.
- Corpus lift: C# ×1.36 (topic mass 20.35)

### cache_stampedes

Go's singleflight is the canonical request-coalescing primitive; .NET HybridCache advertises stampede protection; Caffeine, Rails race_condition_ttl, Symfony's probabilistic early expiration, Python's dogpile.cache and moka cover the rest. C is 0.7 via nginx proxy_cache_lock. In Node/TS the fix (memoizing a promise) is common but there's little dedicated tooling, hence 0.4.

- <https://pkg.go.dev/golang.org/x/sync/singleflight> — Go: duplicate call suppression.
- <https://learn.microsoft.com/en-us/aspnet/core/performance/caching/hybrid> — C#: HybridCache stampede protection.
- <https://symfony.com/doc/current/components/cache.html> — PHP: Symfony Cache stampede prevention via locking and early expiration.
- <https://dogpilecache.sqlalchemy.org/en/latest/> — Python: dogpile.cache, named after the dogpile effect.
- <https://guides.rubyonrails.org/caching_with_rails.html> — Ruby: race_condition_ttl option on Rails.cache.fetch.
- <https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_cache_lock> — C: nginx proxy_cache_lock coalesces cache-miss requests.
- Corpus lift: PHP ×2.04, C# ×1.56 (topic mass 11.99)

### cache_aside_vs_write_through

The pattern is language-neutral and cache-aside appears in every web stack (Rails.cache.fetch, Laravel Cache::remember, Redis clients). Java is highest because JCache/Hazelcast MapStore make read-through/write-through a library-level choice. C/C++ only in cache servers themselves.

- <https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/Strategies.html> — Lazy loading (cache-aside) vs write-through trade-offs.
- <https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside> — Cache-aside pattern and its consistency issues.
- <https://docs.hazelcast.com/hazelcast/latest/mapstore/working-with-external-data> — Java: Hazelcast MapStore read-through/write-through/write-behind.
- Corpus lift: C# ×1.52 (topic mass 15.76)

### stale_reads

Stale reads from caches and lagging replicas are generic; Rails (automatic role switching with a delay) and Laravel (the 'sticky' read/write option) build read-your-writes handling into the framework. Java and Go are highest because they also host the distributed stores where read consistency is configured; C++ counts for databases.

- <https://guides.rubyonrails.org/active_record_multiple_databases.html> — Ruby: replica reads with a delay window to avoid stale reads after writes.
- <https://laravel.com/docs/database> — PHP: 'sticky' option for read-your-writes with read replicas.
- <https://jepsen.io/consistency> — Consistency models that define stale reads (Jepsen tests systems in Java/Go/C++ etc.).
- <https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala> — Facebook memcache: stale sets and leases.
- Corpus lift: C# ×1.57 (topic mass 18.02)

## api

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| rest_design | **1** | **1** | **1** | .7 | .7 | **1** | **1** | **1** | .4 | .1 | .1 | .4 | **1** |
| request_validation | **1** | .7 | **1** | .7 | .7 | **1** | **1** | **1** | .4 | .1 | .1 | .4 | **1** |
| idempotency | .7 | .7 | .7 | .7 | .7 | .7 | .7 | **1** | .4 | .1 | .1 | .4 | .7 |
| versioning | .7 | .7 | **1** | .7 | .7 | .7 | **1** | .7 | .4 | .1 | .1 | .4 | .7 |
| status_codes_and_error_responses | **1** | **1** | **1** | .7 | .7 | **1** | **1** | .7 | .4 | .1 | .1 | .4 | .7 |
| serialization_and_deserialization | .7 | .7 | **1** | .7 | **1** | .7 | **1** | .7 | **1** | .4 | .7 | .7 | .7 |

### rest_design

REST resource design is daily work in the big web-framework ecosystems: Express/NestJS (TS/JS), Spring (Java), FastAPI/Django (Python), ASP.NET Core (C#), Rails (Ruby) and Laravel (PHP). Go and Rust have solid routers (net/http, axum) but thinner conventions; C/C++ services rarely expose hand-designed REST resources.

- <https://spring.io/guides/tutorials/rest/> — Spring's canonical guide to building REST services in Java
- <https://learn.microsoft.com/en-us/aspnet/core/web-api/> — ASP.NET Core web API controllers and conventions in C#
- <https://guides.rubyonrails.org/api_app.html> — Rails as an API-only framework (resourceful routing)
- <https://laravel.com/docs/controllers> — Laravel resource controllers for RESTful routes in PHP
- <https://fastapi.tiangolo.com/> — FastAPI, a mainstream Python REST framework
- <https://github.com/tokio-rs/axum> — axum: the main Rust web framework, a younger and smaller ecosystem
- Corpus lift: no language above ×1.3 (topic mass 32.46)

### request_validation

Each mainstream web stack has a first-class validation layer: zod (TS), Bean Validation/Hibernate Validator (Java), pydantic (Python), model validation (C#), Active Record validations (Ruby), Laravel validation (PHP). Go relies on struct-tag validators; Rust/Scala have them but they are less central; C/C++ validation is hand-rolled parsing rather than an API-layer concern.

- <https://zod.dev/> — zod: TypeScript-first schema validation
- <https://docs.pydantic.dev/latest/> — pydantic: Python data validation used by FastAPI
- <https://hibernate.org/validator/> — Hibernate Validator, the Jakarta Bean Validation reference implementation
- <https://learn.microsoft.com/en-us/aspnet/core/mvc/models/validation> — ASP.NET Core model validation
- <https://laravel.com/docs/validation> — Laravel request validation
- <https://guides.rubyonrails.org/active_record_validations.html> — Rails Active Record validations
- <https://github.com/go-playground/validator> — go-playground/validator: struct-tag validation in Go
- Corpus lift: no language above ×1.3 (topic mass 31.54)

### idempotency

Idempotency keys are a mostly language-agnostic API pattern, so all common web-service languages score 0.7; Ruby gets 1.0 because the best-known reference designs (Stripe's API, Brandur Leach's idempotency-key write-up) come from Ruby shops. Rust/Scala are less common for public payment-style APIs; C/C++ rarely implement HTTP API idempotency.

- <https://docs.stripe.com/api/idempotent_requests> — Stripe's Idempotency-Key semantics for POST requests
- <https://brandur.org/idempotency-keys> — Detailed idempotency-key implementation write-up (Ruby + Postgres)
- <https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/> — IETF draft standardising the Idempotency-Key header (language-agnostic)
- Corpus lift: no language above ×1.3 (topic mass 28.43)

### versioning

Java (Spring Framework's built-in API versioning) and C# (ASP.NET API Versioning) have first-class framework support; Python (DRF versioning schemes), Ruby (Stripe's date-based versioning) and the others do it routinely via routing conventions. Rust/Scala are thinner; C/C++ rarely own versioned public HTTP APIs.

- <https://docs.spring.io/spring-framework/reference/web/webmvc-versioning.html> — Spring MVC's built-in API versioning support
- <https://github.com/dotnet/aspnet-api-versioning> — ASP.NET API Versioning library for C#
- <https://www.django-rest-framework.org/api-guide/versioning/> — Django REST Framework versioning schemes
- <https://stripe.com/blog/api-versioning> — Stripe's API versioning design
- Corpus lift: no language above ×1.3 (topic mass 20.81)

### status_codes_and_error_responses

Mapping exceptions to HTTP status codes and Problem Details bodies is a framework feature in Spring (ProblemDetail, @ExceptionHandler), ASP.NET Core and FastAPI, and routine middleware work in Express/NestJS. Go/Ruby/PHP/Kotlin do it routinely by convention; Rust/Scala less often; C/C++ rarely.

- <https://www.rfc-editor.org/rfc/rfc9457> — RFC 9457 Problem Details for HTTP APIs
- <https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html> — Spring MVC error responses with ProblemDetail
- <https://learn.microsoft.com/en-us/aspnet/core/web-api/handle-errors> — ASP.NET Core web API error handling and ProblemDetails
- <https://fastapi.tiangolo.com/tutorial/handling-errors/> — FastAPI HTTPException and exception handlers
- Corpus lift: no language above ×1.3 (topic mass 26.96)

### serialization_and_deserialization

Java (Jackson and its deserialization vulnerabilities), C# (System.Text.Json, BinaryFormatter), Go (encoding/json tag and zero-value pitfalls) and Rust (serde) all have canonical serialization bug classes. Python (pickle), Ruby (Marshal), PHP (unserialize) and JS (number precision) have well-known pitfalls too; C/C++ meet it as wire-format parsing in infrastructure code (protobuf is common in C++, hand-rolled parsing in C).

- <https://github.com/FasterXML/jackson> — Jackson, the standard JVM JSON library
- <https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html> — OWASP deserialization pitfalls per language (Java, .NET, Python, PHP, Ruby)
- <https://serde.rs/> — serde, the Rust serialization framework
- <https://pkg.go.dev/encoding/json> — Go encoding/json semantics (tags, omitempty, unknown fields)
- <https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/overview> — System.Text.Json in .NET
- <https://docs.python.org/3/library/pickle.html> — Python pickle and its warning against untrusted data
- <https://www.php.net/manual/en/function.unserialize.php> — PHP unserialize and its security warning
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER> — JS safe-integer limit that breaks large numeric IDs in JSON
- Corpus lift: no language above ×1.3 (topic mass 32.17)

## messaging

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| queues_and_consumers | .7 | .7 | **1** | .7 | **1** | **1** | **1** | **1** | .4 | .1 | .4 | .7 | .7 |
| at_least_once_delivery | .4 | .4 | **1** | .7 | .7 | .7 | .7 | **1** | .4 | .1 | .4 | .7 | .4 |
| deduplication | .4 | .4 | **1** | .7 | .7 | .7 | .7 | .7 | .4 | .1 | .1 | .7 | .4 |
| message_ordering | .4 | .4 | **1** | .7 | .7 | .4 | .7 | .4 | .4 | .1 | .4 | .7 | .1 |
| dead_letter_queues | .7 | .4 | **1** | .7 | .7 | .7 | **1** | .7 | .4 | .1 | .1 | .4 | .4 |
| backpressure | .7 | .7 | **1** | **1** | .7 | .4 | .7 | .1 | **1** | .4 | .4 | **1** | .1 |

### queues_and_consumers

Consumer code is mainstream in Java (Kafka clients), Go, Python (Celery), C# (Service Bus/RabbitMQ) and Ruby (Sidekiq); Node has BullMQ, PHP has Laravel queues, Scala has Kafka/Akka. Rust has rdkafka bindings but fewer production consumers; C/C++ appear mostly as client-library or broker internals (librdkafka), not application consumers.

- <https://kafka.apache.org/documentation/> — Apache Kafka docs, including the Java consumer API
- <https://docs.celeryq.dev/en/stable/> — Celery distributed task queue for Python
- <https://github.com/sidekiq/sidekiq> — Sidekiq background jobs for Ruby
- <https://docs.bullmq.io/> — BullMQ queues for Node.js/TypeScript
- <https://laravel.com/docs/queues> — Laravel queues and workers in PHP
- <https://github.com/confluentinc/librdkafka> — librdkafka: the C/C++ Kafka client that other language bindings wrap
- Corpus lift: no language above ×1.3 (topic mass 27.89)

### at_least_once_delivery

At-least-once semantics are explicit in Kafka's consumer model (commit after processing) and in Sidekiq's documented guarantee that jobs run at least once; Celery acks_late, Go and .NET consumers meet it routinely. Node/PHP consumers exist but the topic is discussed less there; C/C++ only at broker/client level.

- <https://kafka.apache.org/documentation/> — Kafka message delivery semantics (at-most/at-least/exactly once)
- <https://github.com/sidekiq/sidekiq/wiki/FAQ> — Sidekiq runs jobs at least once, so they must be idempotent
- <https://docs.celeryq.dev/en/stable/userguide/tasks.html> — Celery acks_late and task redelivery
- <https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html> — SQS standard queues deliver at least once
- <https://www.rabbitmq.com/docs/confirms> — RabbitMQ consumer acknowledgements and redelivery
- Corpus lift: Scala ×1.31 (topic mass 21.3)

### deduplication

Idempotent consumers and dedup tables are a staple of JVM event-driven services; Go, Python, C# (Service Bus duplicate detection), Ruby (idempotent Sidekiq jobs) and Scala do it routinely. Node/PHP/Rust less often; C/C++ essentially only inside brokers.

- <https://microservices.io/patterns/communication-style/idempotent-consumer.html> — Idempotent Consumer pattern (records processed message IDs)
- <https://learn.microsoft.com/en-us/azure/service-bus-messaging/duplicate-detection> — Azure Service Bus duplicate detection
- <https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/using-messagededuplicationid-property.html> — SQS FIFO MessageDeduplicationId
- <https://github.com/sidekiq/sidekiq/wiki/Best-Practices> — Sidekiq best practice: make jobs idempotent
- Corpus lift: Rust ×1.36, Scala ×1.36 (topic mass 19.66)

### message_ordering

Per-partition ordering and keying is a core Kafka concern, so Java (plus Kotlin/Scala/Go Kafka consumers) dominates; C# meets it via Service Bus sessions. Python/Node/Ruby job queues usually give no ordering guarantee and the topic surfaces less; PHP request-scoped workers rarely care.

- <https://kafka.apache.org/documentation/> — Kafka guarantees ordering only within a partition
- <https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-sessions> — Azure Service Bus sessions for FIFO ordering
- <https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues.html> — SQS FIFO queues and message-group ordering
- Corpus lift: Scala ×1.45 (topic mass 16.67)

### dead_letter_queues

Java (Spring Kafka dead-letter publishing) and C# (Service Bus dead-letter subqueue) have first-class DLQ handling; Go/Python/Ruby/TS consumers configure DLQs routinely on SQS/RabbitMQ. Rust/Scala/PHP less commonly; C/C++ rarely at the application level.

- <https://docs.spring.io/spring-kafka/reference/kafka/annotation-error-handling.html> — Spring Kafka error handling and dead-letter topics
- <https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-dead-letter-queues> — Azure Service Bus dead-letter queues
- <https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html> — SQS dead-letter queues and maxReceiveCount
- <https://www.rabbitmq.com/docs/dlx> — RabbitMQ dead letter exchanges
- Corpus lift: no language above ×1.3 (topic mass 13.09)

### backpressure

Backpressure is built into Reactive Streams (Java Reactor), Kotlin Flow, Akka/Pekko Streams (Scala) and bounded tokio channels (Rust); Node streams expose it via highWaterMark, Go via bounded channels, C# via System.Threading.Channels. Python asyncio supports it but it is less discussed; Ruby and PHP have little streaming-pipeline ecosystem.

- <https://www.reactive-streams.org/> — Reactive Streams: asynchronous stream processing with non-blocking backpressure (JVM)
- <https://kotlinlang.org/docs/flow.html> — Kotlin Flow (suspending, backpressure-aware streams)
- <https://pekko.apache.org/docs/pekko/current/stream/stream-flows-and-basics.html> — Pekko (Akka) Streams backpressure in Scala
- <https://docs.rs/tokio/latest/tokio/sync/mpsc/index.html> — tokio bounded mpsc channels provide backpressure
- <https://nodejs.org/en/learn/modules/backpressuring-in-streams> — Node.js guide to backpressuring in streams
- <https://learn.microsoft.com/en-us/dotnet/core/extensions/channels> — System.Threading.Channels bounded channels in .NET
- Corpus lift: C# ×1.71, Scala ×1.59, PHP ×1.42 (topic mass 17.23)

## errors

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| error_propagation | .7 | .7 | **1** | .7 | **1** | .7 | .7 | .4 | **1** | **1** | .7 | .7 | .4 |
| error_wrapping_and_context | .4 | .4 | **1** | .7 | **1** | .7 | .7 | .4 | **1** | .1 | .4 | .4 | .4 |
| swallowed_errors | **1** | **1** | **1** | .7 | **1** | **1** | .7 | .7 | .4 | **1** | .7 | .4 | .7 |
| cleanup_on_error_paths | .4 | .4 | **1** | .7 | **1** | .7 | **1** | .4 | .4 | **1** | **1** | .4 | .1 |
| panics_and_exceptions_at_boundaries | .7 | .7 | .7 | .7 | **1** | .4 | .7 | .4 | **1** | .1 | **1** | .4 | .1 |

### error_propagation

Propagation is explicit and central in Go (if err != nil), Rust (Result and ?), C (return codes/errno) and Java (checked exceptions); exception-based languages meet it routinely but less visibly. Ruby/PHP code tends to let exceptions bubble with little ceremony, so they score lower.

- <https://go.dev/blog/error-handling-and-go> — Go's explicit error values and propagation
- <https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html> — Rust Result and the ? operator
- <https://docs.oracle.com/javase/tutorial/essential/exceptions/> — Java exceptions, including checked exceptions
- <https://man7.org/linux/man-pages/man3/errno.3.html> — C errno / return-code error reporting
- Corpus lift: no language above ×1.3 (topic mass 29.9)

### error_wrapping_and_context

Go (fmt.Errorf %w, errors.Is/As), Rust (anyhow/thiserror context) and Java (exception cause chaining) make wrapping a core idiom; Python (raise ... from) and C# (InnerException) use it routinely. JS/TS gained Error.cause only recently; C has no wrapping mechanism beyond logging.

- <https://go.dev/blog/go1.13-errors> — Go 1.13 error wrapping with %w, errors.Is and errors.As
- <https://docs.rs/anyhow/latest/anyhow/> — anyhow: Rust error type with .context()
- <https://docs.python.org/3/tutorial/errors.html> — Python exception chaining (raise ... from)
- <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause> — JavaScript Error.cause (a recent addition)
- Corpus lift: no language above ×1.3 (topic mass 25.76)

### swallowed_errors

Canonical bug classes: empty catch blocks (Java), ignored err return values (Go, caught by errcheck), bare except (Python), unchecked return codes (C) and unawaited or unhandled promise rejections (JS/TS). Rust's #[must_use] on Result and Scala's Try/Either make silent swallowing less natural.

- <https://cwe.mitre.org/data/definitions/1069.html> — CWE-1069 Empty Exception Block
- <https://cwe.mitre.org/data/definitions/390.html> — CWE-390 Detection of Error Condition Without Action
- <https://github.com/kisielk/errcheck> — errcheck: linter for unchecked errors in Go
- <https://docs.astral.sh/ruff/rules/bare-except/> — Ruff rule against bare except in Python
- <https://nodejs.org/api/process.html> — Node.js unhandledRejection event
- <https://doc.rust-lang.org/std/result/> — Rust: Result is #[must_use], so ignoring it warns
- Corpus lift: no language above ×1.3 (topic mass 24.66)

### cleanup_on_error_paths

Cleanup on error paths is a canonical C bug class (goto-cleanup chains) and the C++ exception-safety/RAII topic; Go defer, Java try-with-resources and C# using are the mainstream idioms and are regularly misused. Rust's Drop makes most cleanup automatic; PHP's request-scoped model frees resources at request end.

- <https://wiki.sei.cmu.edu/confluence/display/c/MEM12-C.+Consider+using+a+goto+chain+when+leaving+a+function+on+error+when+using+and+releasing+resources> — CERT C MEM12-C: goto chains for releasing resources on error
- <https://en.cppreference.com/w/cpp/language/raii> — C++ RAII
- <https://go.dev/blog/defer-panic-and-recover> — Go defer for cleanup
- <https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html> — Java try-with-resources
- <https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/using> — C# using statement
- <https://doc.rust-lang.org/std/ops/trait.Drop.html> — Rust Drop runs cleanup automatically
- Corpus lift: no language above ×1.3 (topic mass 23.08)

### panics_and_exceptions_at_boundaries

Go (a panic in a spawned goroutine kills the process; net/http recovers only the handler's own goroutine), Rust (panics across FFI and threads, catch_unwind) and C++ (exceptions crossing threads, noexcept, C ABIs) make boundary handling a core concern. Node's unhandled rejections, Java's UncaughtExceptionHandler and Kotlin coroutine handlers are common settings; C has no exceptions and PHP's per-request model contains failures.

- <https://go.dev/blog/defer-panic-and-recover> — Go panic and recover
- <https://pkg.go.dev/net/http> — net/http recovers handler panics only for that request
- <https://doc.rust-lang.org/std/panic/fn.catch_unwind.html> — Rust catch_unwind at boundaries
- <https://doc.rust-lang.org/nomicon/ffi.html> — Rustonomicon: unwinding across FFI
- <https://isocpp.org/wiki/faq/exceptions> — C++ FAQ on exceptions and error handling
- <https://nodejs.org/api/process.html> — Node.js uncaughtException/unhandledRejection
- <https://docs.oracle.com/javase/8/docs/api/java/lang/Thread.UncaughtExceptionHandler.html> — Java Thread.UncaughtExceptionHandler
- Corpus lift: no language above ×1.3 (topic mass 23.09)

## resources

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| memory_leaks | .7 | .7 | **1** | .7 | .7 | .7 | .7 | .4 | .4 | **1** | **1** | .7 | .4 |
| file_and_socket_handle_leaks | .4 | .4 | **1** | .7 | **1** | .7 | **1** | .4 | .1 | **1** | .7 | .7 | .1 |
| streaming_large_payloads | **1** | **1** | .7 | .4 | **1** | .7 | .7 | .4 | .7 | .4 | .4 | .7 | .4 |
| unbounded_buffers | .4 | .4 | **1** | .7 | **1** | .7 | .7 | .1 | **1** | .7 | .7 | .7 | .1 |
| context_cancellation | .7 | .7 | .4 | **1** | **1** | .7 | **1** | .4 | .7 | .1 | .1 | .4 | .1 |

### memory_leaks

C and C++ are the classic home (Valgrind, LeakSanitizer); Java leak hunting (heap dumps, retained collections) is routine in long-running JVM services. Node, Go (goroutine leaks), Python, C# and Scala all have documented leak diagnostics; Rust leaks only via Rc cycles or deliberate leaks, and PHP only in long-running workers such as Octane.

- <https://valgrind.org/docs/manual/mc-manual.html> — Valgrind Memcheck leak detection for C/C++
- <https://clang.llvm.org/docs/LeakSanitizer.html> — LeakSanitizer
- <https://docs.oracle.com/en/java/javase/17/troubleshoot/troubleshooting-memory-leaks.html> — Oracle guide to troubleshooting Java memory leaks
- <https://nodejs.org/en/learn/diagnostics/memory> — Node.js memory diagnostics
- <https://learn.microsoft.com/en-us/dotnet/core/diagnostics/debug-memory-leak> — Debugging a .NET memory leak
- <https://docs.python.org/3/library/tracemalloc.html> — Python tracemalloc
- <https://doc.rust-lang.org/book/ch15-06-reference-cycles.html> — Rust: reference cycles can leak memory
- <https://laravel.com/docs/octane> — Laravel Octane restarts workers to contain memory leaks
- Corpus lift: PHP ×1.74, C++ ×1.58, Scala ×1.41 (topic mass 18.74)

### file_and_socket_handle_leaks

Canonical bug classes: unclosed resp.Body in Go, missing try-with-resources in Java, HttpClient/IDisposable socket exhaustion in C#, and leaked file descriptors (EMFILE) in C. Python warns via ResourceWarning; Rust closes on Drop and PHP closes handles at request end, so leaks there look contrived.

- <https://pkg.go.dev/net/http> — Go: the caller must close the response body
- <https://learn.microsoft.com/en-us/dotnet/fundamentals/networking/http/httpclient-guidelines> — HttpClient guidelines: port/socket exhaustion in .NET
- <https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html> — Java try-with-resources for closing streams and sockets
- <https://man7.org/linux/man-pages/man2/open.2.html> — open(2): EMFILE when the process fd limit is reached
- <https://docs.python.org/3/library/exceptions.html> — Python ResourceWarning for unclosed resources
- Corpus lift: PHP ×1.99, C ×1.43, C++ ×1.39 (topic mass 16.35)

### streaming_large_payloads

Node streams and Go io.Reader/io.Copy make streaming the default idiom, so buffering a whole body in memory is a recognisable bug there. Java (StreamingResponseBody, InputStream), Python (requests stream=True, StreamingResponse), C#, Rust (tokio io) and Scala (Pekko Streams) do it regularly; Ruby/PHP/Kotlin and C/C++ less commonly at the API layer.

- <https://nodejs.org/api/stream.html> — Node.js stream API
- <https://pkg.go.dev/io> — Go io.Reader/io.Writer streaming interfaces
- <https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html> — Spring MVC StreamingResponseBody
- <https://requests.readthedocs.io/en/latest/user/advanced/> — Python requests stream=True body workflow
- <https://fastapi.tiangolo.com/advanced/custom-response/> — FastAPI StreamingResponse
- Corpus lift: Scala ×2.02, Rust ×1.35 (topic mass 18.54)

### unbounded_buffers

Java (Executors.newFixedThreadPool's unbounded queue), Go (growing slices/channels and unbounded goroutine fan-out) and Rust (tokio unbounded_channel) have canonical unbounded-queue bugs; asyncio.Queue defaults to unbounded, .NET has Channel.CreateUnbounded, and C/C++ infrastructure code meets growing buffers routinely. Ruby/PHP request-scoped code rarely builds in-process queues.

- <https://docs.oracle.com/javase/8/docs/api/java/util/concurrent/Executors.html> — Java newFixedThreadPool uses a shared unbounded queue
- <https://docs.rs/tokio/latest/tokio/sync/mpsc/fn.unbounded_channel.html> — tokio unbounded_channel (no backpressure)
- <https://docs.python.org/3/library/asyncio-queue.html> — asyncio.Queue is unbounded when maxsize <= 0
- <https://learn.microsoft.com/en-us/dotnet/core/extensions/channels> — System.Threading.Channels bounded vs unbounded
- <https://cwe.mitre.org/data/definitions/770.html> — CWE-770 Allocation of Resources Without Limits
- Corpus lift: Scala ×1.62, PHP ×1.51, C++ ×1.45, C# ×1.4 (topic mass 16.16)

### context_cancellation

Cancellation is first-class in Go (context.Context), C# (CancellationToken) and Kotlin (structured coroutine cancellation); JS/TS have AbortController, Python has asyncio task cancellation, Rust has future dropping and CancellationToken. Java relies on thread interrupts, Ruby's Timeout is notoriously unsafe, and C/C++/PHP have no common cancellation model in backend code.

- <https://pkg.go.dev/context> — Go context package: deadlines and cancellation
- <https://learn.microsoft.com/en-us/dotnet/standard/threading/cancellation-in-managed-threads> — Cancellation in .NET (CancellationToken)
- <https://kotlinlang.org/docs/cancellation-and-timeouts.html> — Kotlin coroutine cancellation and timeouts
- <https://developer.mozilla.org/en-US/docs/Web/API/AbortController> — AbortController for JS/TS cancellation
- <https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html> — tokio-util CancellationToken in Rust
- <https://docs.oracle.com/javase/tutorial/essential/concurrency/interrupt.html> — Java thread interrupts as cooperative cancellation
- <https://mikeperham.com/2015/05/08/timeout-rubys-most-dangerous-api/> — Why Ruby's Timeout is unsafe for cancelling work
- Corpus lift: Rust ×1.38, Go ×1.3 (topic mass 17.43)

## security

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| authentication | **1** | .7 | **1** | .7 | .7 | **1** | **1** | **1** | .4 | .4 | .4 | .4 | **1** |
| authorization_checks | **1** | .7 | **1** | .7 | .7 | **1** | **1** | **1** | .4 | .4 | .1 | .4 | **1** |
| sql_injection | .7 | .7 | **1** | .4 | .7 | **1** | .7 | .7 | .4 | .4 | .1 | .4 | **1** |
| input_sanitization | .7 | .7 | .7 | .4 | .7 | .7 | .7 | .7 | .4 | **1** | .7 | .4 | **1** |
| secrets_handling | .7 | .7 | .7 | .7 | **1** | .7 | **1** | .7 | .4 | .4 | .4 | .4 | .7 |
| session_and_token_handling | **1** | **1** | **1** | .4 | .7 | .7 | .7 | .7 | .4 | .1 | .1 | .4 | **1** |
| audit_logging | .7 | .4 | **1** | .7 | .7 | .7 | .7 | **1** | .4 | .4 | .1 | .4 | .7 |
| encryption_at_rest_and_in_transit | .4 | .4 | **1** | .7 | **1** | .7 | .7 | .7 | .7 | **1** | .7 | .4 | .7 |
| multi_tenant_isolation | .7 | .4 | .7 | .4 | .7 | .7 | **1** | **1** | .4 | .1 | .1 | .4 | .7 |

### authentication

Web stacks with first-class auth frameworks (Spring Security, ASP.NET Core Identity, Django auth, Devise, Laravel, Passport) are where engineers routinely read login/credential code. Go, Kotlin and Node have solid but thinner library support; Rust, Scala and C/C++ meet it mostly in infrastructure (database or proxy auth methods), which is plausible but less common.

- <https://docs.spring.io/spring-security/reference/index.html> — Spring Security: the standard authentication framework for Java/Kotlin services
- <https://learn.microsoft.com/en-us/aspnet/core/security/authentication/identity> — ASP.NET Core Identity: built-in authentication for C# backends
- <https://docs.djangoproject.com/en/stable/topics/auth/> — Django's built-in authentication system (Python)
- <https://github.com/heartcombo/devise> — Devise: the de facto Rails authentication library (Ruby)
- <https://laravel.com/docs/authentication> — Laravel authentication guards and providers (PHP)
- <https://www.passportjs.org/> — Passport: authentication middleware for Node.js (JS/TS)
- <https://www.postgresql.org/docs/current/auth-methods.html> — Authentication methods implemented in PostgreSQL (C infrastructure): why C is plausible, not zero
- Corpus lift: JavaScript ×1.41 (topic mass 23.27)

### authorization_checks

Missing or wrong object-level checks in controllers/policies are the canonical broken-access-control bug in framework-heavy web stacks (Spring Security, ASP.NET policies, Pundit, Laravel gates, Django permissions, Nest guards). Go has Casbin and handwritten middleware; C appears via ACL checks in servers like Redis, while C++/Rust/Scala service code rarely centres on it.

- <https://owasp.org/Top10/A01_2021-Broken_Access_Control/> — Broken access control is OWASP Top 10 #1 for web applications
- <https://docs.spring.io/spring-security/reference/servlet/authorization/index.html> — Spring Security authorization (Java/Kotlin)
- <https://learn.microsoft.com/en-us/aspnet/core/security/authorization/introduction> — ASP.NET Core policy-based authorization (C#)
- <https://github.com/varvet/pundit> — Pundit: policy-object authorization in Rails (Ruby)
- <https://laravel.com/docs/authorization> — Laravel gates and policies (PHP)
- <https://github.com/casbin/casbin> — Casbin: authorization library originating in Go
- <https://redis.io/docs/latest/operate/oss_and_stack/management/security/acl/> — Redis ACLs: authorization checks inside C infrastructure software
- Corpus lift: TypeScript ×1.49, Ruby ×1.3 (topic mass 30.04)

### sql_injection

SQL injection via string-built queries is the classic bug in PHP, Java (JDBC) and Python (DB-API, raw SQLAlchemy/Django SQL), all with prominent OWASP and official guidance; Go, Node, C# and Rails have official warnings about interpolated SQL. Rust's sqlx/Diesel and Kotlin/Scala DSLs make it less natural, and C++ backends rarely build SQL strings by hand.

- <https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html> — OWASP SQLi prevention with per-language examples (Java, .NET, PHP, etc.)
- <https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html> — Parameterized query examples across Java, C#, PHP, Ruby, Perl and others
- <https://www.php.net/manual/en/pdo.prepared-statements.php> — PHP manual: PDO prepared statements as the SQLi defence
- <https://go.dev/doc/database/sql-injection> — Go official docs: avoiding SQL injection risk with database/sql
- <https://guides.rubyonrails.org/security.html> — Rails security guide: SQL injection through string conditions in Active Record
- <https://github.com/launchbadge/sqlx> — sqlx: compile-time checked queries in Rust, which reduces string-built SQL
- <https://cwe.mitre.org/data/definitions/89.html> — CWE-89 with demonstrative examples in several languages including C
- Corpus lift: no language above ×1.3 (topic mass 13.34)

### input_sanitization

PHP (output escaping, htmlspecialchars, XSS) and C (unchecked lengths leading to buffer overflows, CWE-120) are the canonical homes of unvalidated-input bugs; most web stacks meet validation/escaping routinely. Rust's bounds checking and Kotlin/Scala's typed request binding make classic input bugs less natural there.

- <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html> — OWASP input validation guidance for web backends
- <https://cwe.mitre.org/data/definitions/120.html> — CWE-120 classic buffer overflow from unchecked input size, with C/C++ examples
- <https://www.php.net/manual/en/function.htmlspecialchars.php> — PHP's core escaping function, central to PHP input/output sanitization
- <https://guides.rubyonrails.org/security.html> — Rails security guide on injection, XSS and sanitization helpers
- Corpus lift: Rust ×1.4, JavaScript ×1.32 (topic mass 19.26)

### secrets_handling

Mostly language-agnostic (env vars, vaults, no hardcoded keys), but .NET (User Secrets, configuration providers) and Go (the Vault/Kubernetes infrastructure ecosystem) have the most built-in machinery; Spring Cloud Vault, Rails credentials and Laravel .env make the rest common. Rust, Scala and C/C++ see it mainly as key zeroing or config plumbing in infrastructure code.

- <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html> — OWASP secrets management guidance (language-neutral)
- <https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets> — ASP.NET Core safe storage of app secrets in development (C#)
- <https://docs.spring.io/spring-cloud-vault/reference/> — Spring Cloud Vault: secrets injection for Java/Kotlin services
- <https://guides.rubyonrails.org/security.html> — Rails guide section on custom credentials (encrypted credentials file)
- <https://12factor.net/config> — Twelve-factor guidance on keeping credentials out of code
- Corpus lift: no language above ×1.3 (topic mass 19.03)

### session_and_token_handling

Node (express-session, jsonwebtoken), Java (JJWT/Spring) and PHP (native sessions) are where session/JWT validation mistakes are most discussed; OWASP's JWT and session cheat sheets centre on these stacks. Python, Ruby, C# and Go have standard libraries (PyJWT, Rails cookie store, golang-jwt), while C/C++ rarely implement web sessions.

- <https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html> — OWASP session management pitfalls (fixation, expiry, cookie flags)
- <https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html> — OWASP JWT cheat sheet (signature validation, algorithm confusion, revocation)
- <https://github.com/auth0/node-jsonwebtoken> — jsonwebtoken: the dominant Node.js JWT library
- <https://github.com/expressjs/session> — express-session: standard session middleware for Node
- <https://github.com/golang-jwt/jwt> — golang-jwt: the standard Go JWT library
- <https://github.com/jpadilla/pyjwt> — PyJWT: the standard Python JWT library
- Corpus lift: JavaScript ×1.47 (topic mass 16.58)

### audit_logging

Mature audit libraries make it routine in Ruby (PaperTrail) and Java (Hibernate Envers); Go has Kubernetes API audit logging, and the other web stacks implement audit trails with ORM hooks. C appears via pgaudit, while Rust, Scala and C++ rarely centre on it.

- <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html> — OWASP: which security events to record in audit logs
- <https://github.com/paper-trail-gem/paper_trail> — PaperTrail: model change auditing for Rails
- <https://hibernate.org/orm/envers/> — Hibernate Envers: entity auditing for Java
- <https://kubernetes.io/docs/tasks/debug/debug-cluster/audit/> — Kubernetes API server auditing (Go)
- <https://github.com/pgaudit/pgaudit> — pgaudit: PostgreSQL audit extension (C)
- Corpus lift: no language above ×1.3 (topic mass 15.24)

### encryption_at_rest_and_in_transit

C (OpenSSL), Go (crypto/tls in the stdlib) and Java (JCA/JSSE) are the mainstream homes of TLS configuration and cipher-misuse bugs; Rust (rustls), C++, Python (cryptography), .NET, Rails (Active Record encryption) and PHP (sodium, Laravel encryption) are common. Node services usually terminate TLS elsewhere and use node:crypto less often.

- <https://www.openssl.org/> — OpenSSL: the C TLS/crypto library underlying much infrastructure
- <https://pkg.go.dev/crypto/tls> — Go standard library TLS
- <https://docs.oracle.com/en/java/javase/21/security/java-cryptography-architecture-jca-reference-guide.html> — Java Cryptography Architecture reference
- <https://github.com/rustls/rustls> — rustls: TLS in Rust
- <https://cryptography.io/en/latest/> — pyca/cryptography for Python
- <https://guides.rubyonrails.org/active_record_encryption.html> — Rails Active Record encryption (at rest)
- <https://www.php.net/manual/en/book.sodium.php> — PHP sodium extension
- <https://www.postgresql.org/docs/current/ssl-tcp.html> — PostgreSQL TLS connections (C infrastructure)
- Corpus lift: Scala ×1.43 (topic mass 16.53)

### multi_tenant_isolation

Ruby (acts_as_tenant, Apartment) and C# (EF Core global query filters, official multi-tenancy guidance) have first-class tenant-scoping patterns where a missing filter is the canonical bug; Python (django-tenants), Java (Hibernate) and Node/Go SaaS backends are common. C/C++ backends almost never implement tenant scoping in application code (it lives in the database, e.g. PostgreSQL RLS).

- <https://learn.microsoft.com/en-us/ef/core/miscellaneous/multitenancy> — EF Core multi-tenancy guidance (global query filters, per-tenant databases)
- <https://github.com/ErwinM/acts_as_tenant> — acts_as_tenant: row-level tenant scoping for Rails
- <https://github.com/django-tenants/django-tenants> — django-tenants: schema-based multi-tenancy for Django
- <https://www.postgresql.org/docs/current/ddl-rowsecurity.html> — PostgreSQL row-level security, often used for tenant isolation at the DB layer
- Corpus lift: TypeScript ×1.61, Ruby ×1.55, C# ×1.52 (topic mass 18.24)

## observability

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| structured_logging | .7 | .7 | **1** | .7 | **1** | .7 | **1** | .4 | .7 | .1 | .4 | .4 | .4 |
| metrics | .7 | .7 | **1** | .7 | **1** | .7 | .7 | .4 | .7 | .4 | .7 | .7 | .4 |
| tracing | .7 | .7 | **1** | .7 | **1** | .7 | **1** | .4 | .7 | .1 | .7 | .4 | .4 |
| health_checks | .7 | .7 | **1** | .7 | **1** | .7 | **1** | .4 | .7 | .1 | .4 | .4 | .4 |
| logging_sensitive_data | .7 | .7 | **1** | .7 | .7 | .7 | .7 | **1** | .4 | .1 | .1 | .4 | .7 |

### structured_logging

Go ships structured logging in the standard library (log/slog), C# has Serilog's message templates, and Java has MDC plus JSON encoders; these are routine. Python (structlog), Node (pino) and Rust (tracing) are common; Ruby, PHP (Monolog context) and C++ (spdlog) are thinner, and C services usually log plain text.

- <https://pkg.go.dev/log/slog> — Go standard library structured logging
- <https://serilog.net/> — Serilog structured logging for .NET
- <https://github.com/logfellow/logstash-logback-encoder> — JSON/structured logging for Logback (Java)
- <https://www.structlog.org/> — structlog for Python
- <https://getpino.io/> — pino JSON logger for Node.js
- <https://docs.rs/tracing/latest/tracing/> — Rust tracing crate with structured fields
- <https://github.com/Seldaek/monolog> — Monolog: PHP logging with context arrays
- Corpus lift: PHP ×1.32 (topic mass 27.73)

### metrics

Prometheus' official clients are Go, Java/Scala, Python, Ruby, Rust and Node; Go and Java (Micrometer) are the mainstream homes of metric instrumentation bugs (cardinality, counter vs gauge). C++ infrastructure (Envoy) is metric-heavy; C, Ruby and PHP rely on thinner or third-party support (PHP's shared-nothing model needs external storage).

- <https://prometheus.io/docs/instrumenting/clientlibs/> — Official Prometheus clients: Go, Java/Scala, Python, Ruby, Rust, Node; C, C++, .NET and PHP third-party
- <https://micrometer.io/> — Micrometer: the JVM metrics facade used by Spring Boot
- <https://github.com/prometheus/client_golang> — Prometheus Go client
- <https://opentelemetry.io/docs/languages/> — OpenTelemetry metrics stability per language (Kotlin and Ruby metrics still in development)
- <https://github.com/jupp0r/prometheus-cpp> — prometheus-cpp: C++ metrics client
- Corpus lift: PHP ×1.57 (topic mass 33.68)

### tracing

OpenTelemetry tracing is stable and widely deployed in Java, Go and .NET (where context propagation bugs are a routine topic); Python, Node, C++ (Envoy) and Rust (tracing crate) are common. Ruby and PHP have stable SDKs but less usage, Kotlin uses the JVM SDK, and C has essentially no mainstream tracing SDK.

- <https://opentelemetry.io/docs/languages/> — OpenTelemetry per-language status (traces stable for C++, .NET, Go, Java, JS, PHP, Python, Ruby; Rust beta; no C SDK)
- <https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/observability/tracing> — Envoy (C++) distributed tracing architecture
- <https://docs.rs/tracing/latest/tracing/> — Rust tracing crate (spans and instrumentation)
- <https://github.com/open-telemetry/opentelemetry-cpp> — OpenTelemetry C++ SDK
- Corpus lift: no language above ×1.3 (topic mass 23.6)

### health_checks

Spring Boot Actuator and ASP.NET Core health checks are built-in frameworks for liveness/readiness, and Go is the home of Kubernetes probes and the gRPC health protocol. Other web stacks add a handler by hand; C/C++ infrastructure exposes admin endpoints but rarely as a reading exercise topic.

- <https://docs.spring.io/spring-boot/reference/actuator/endpoints.html> — Spring Boot Actuator health endpoint and indicators (Java/Kotlin)
- <https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks> — ASP.NET Core health checks middleware (C#)
- <https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/> — Kubernetes liveness/readiness/startup probes (language-neutral, Go examples)
- <https://github.com/grpc/grpc/blob/master/doc/health-checking.md> — gRPC health checking protocol
- <https://www.envoyproxy.io/docs/envoy/latest/operations/admin> — Envoy admin interface health endpoints (C++ infrastructure)
- Corpus lift: PHP ×1.98, Kotlin ×1.57 (topic mass 20.58)

### logging_sensitive_data

Logging whole request objects or entities (Java toString, Kotlin data classes) and request params is a canonical leak; Rails has filter_parameters for exactly this. Rust (derived Debug) and Scala (case class toString) can leak too but it is less discussed; C/C++ services rarely log user payloads.

- <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html> — OWASP logging cheat sheet: data to exclude from logs (passwords, tokens, PII)
- <https://guides.rubyonrails.org/configuring.html> — Rails configuration including filter_parameters to mask sensitive params in logs
- <https://techcrunch.com/2018/05/03/twitter-password-bug/> — Twitter 2018: a bug wrote plaintext passwords to an internal log (GitHub had a similar incident days earlier)
- Corpus lift: no language above ×1.3 (topic mass 18.2)

## config

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| configuration_loading | .7 | .7 | **1** | .7 | **1** | .7 | **1** | .4 | .7 | .4 | .4 | .7 | .4 |
| feature_flags | .7 | .7 | .7 | .7 | .7 | .7 | .7 | **1** | .4 | .1 | .4 | .4 | .7 |
| environment_specific_behaviour | .7 | .7 | **1** | .7 | .4 | .7 | **1** | **1** | .4 | .4 | .4 | .4 | .7 |
| defaults_and_validation | .7 | .7 | **1** | .7 | .7 | **1** | **1** | .4 | .7 | .4 | .4 | .4 | .4 |

### configuration_loading

Spring Boot's externalized configuration and .NET's layered configuration providers make precedence/binding bugs routine; Go's Viper is the standard for services and CLIs. Python (pydantic-settings), Node and Rust (config + serde) are common; Ruby/PHP frameworks hide most loading, and C/C++ infra parses config files by hand (PostgreSQL, Abseil flags).

- <https://docs.spring.io/spring-boot/reference/features/external-config.html> — Spring Boot externalized configuration and property source ordering
- <https://learn.microsoft.com/en-us/aspnet/core/fundamentals/configuration/> — ASP.NET Core configuration providers and precedence
- <https://github.com/spf13/viper> — Viper: configuration loading for Go
- <https://docs.pydantic.dev/latest/concepts/pydantic_settings/> — pydantic-settings for Python
- <https://docs.rs/config/latest/config/> — Rust config crate (layered configuration)
- <https://www.postgresql.org/docs/current/config-setting.html> — PostgreSQL configuration file parsing (C infrastructure)
- Corpus lift: PHP ×1.51 (topic mass 18.86)

### feature_flags

Feature-flag SDKs (OpenFeature, LaunchDarkly, Unleash) cover all mainstream web languages, so most are common; Ruby gets 1.0 for Flipper and the Rails culture of flag-gated rollouts. Rust and Scala have thinner SDK support, C++ infrastructure uses runtime flags (Envoy), and C rarely has them.

- <https://openfeature.dev/docs/reference/technologies/> — OpenFeature SDKs per language
- <https://launchdarkly.com/docs/sdk> — LaunchDarkly server-side SDK list
- <https://docs.getunleash.io/reference/sdks> — Unleash SDK list
- <https://github.com/flippercloud/flipper> — Flipper: feature flags for Ruby/Rails
- <https://www.envoyproxy.io/docs/envoy/latest/operations/runtime> — Envoy runtime feature flags (C++ infrastructure)
- Corpus lift: Kotlin ×1.66 (topic mass 23.46)

### environment_specific_behaviour

Rails environments, Spring profiles and ASP.NET Core environments are framework features where dev/prod divergence bugs are routine; Django settings, NODE_ENV and Laravel APP_ENV are common. Go and Rust have no framework convention (env vars, build tags, cfg), and C/C++ mostly see it as #ifdef/NDEBUG differences.

- <https://docs.spring.io/spring-boot/reference/features/profiles.html> — Spring Boot profiles
- <https://learn.microsoft.com/en-us/aspnet/core/fundamentals/environments> — ASP.NET Core runtime environments (Development/Staging/Production)
- <https://guides.rubyonrails.org/configuring.html> — Rails per-environment configuration files
- <https://12factor.net/config> — Twelve-factor: config that varies between deploys belongs in the environment
- Corpus lift: PHP ×1.37 (topic mass 17.83)

### defaults_and_validation

Python (pydantic-settings), .NET (options validation) and Spring (@ConfigurationProperties with @Validated) have first-class typed config validation; Go's zero values and envconfig defaults, Rust's serde defaults and zod in Node are common settings. Ruby, PHP, Scala and C/C++ do it ad hoc.

- <https://docs.pydantic.dev/latest/concepts/pydantic_settings/> — pydantic-settings: typed settings with defaults and validation
- <https://learn.microsoft.com/en-us/dotnet/core/extensions/options> — .NET options pattern including options validation
- <https://docs.spring.io/spring-boot/reference/features/external-config.html> — Spring Boot type-safe @ConfigurationProperties and validation
- <https://github.com/kelseyhightower/envconfig> — envconfig: Go env config with defaults and required fields
- <https://zod.dev/> — zod: schema validation commonly used for env/config in TypeScript
- <https://github.com/serde-rs/serde> — serde: Rust deserialization with field defaults
- Corpus lift: no language above ×1.3 (topic mass 16.84)

## testing

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| unit_test_design | **1** | .7 | **1** | .7 | **1** | **1** | **1** | **1** | .7 | .4 | .7 | .7 | .7 |
| mocking_and_fakes | **1** | **1** | **1** | **1** | .7 | **1** | **1** | .7 | .4 | .1 | .4 | .4 | .7 |
| flaky_tests | .7 | .7 | **1** | .7 | .7 | .7 | .7 | .7 | .4 | .1 | .4 | .4 | .4 |
| integration_tests | .7 | .7 | **1** | .7 | .7 | .7 | .7 | **1** | .4 | .1 | .4 | .4 | .7 |

### unit_test_design

Every mainstream backend language has a standard test framework (JUnit, pytest, Go testing, xUnit/NUnit, RSpec, Jest, cargo test, GoogleTest, ScalaTest, PHPUnit), so most score high; the 1.0s have the strongest test-design culture and literature. C has thin, fragmented frameworks.

- <https://junit.org/junit5/docs/current/user-guide/> — JUnit 5 user guide (Java/Kotlin)
- <https://docs.pytest.org/en/stable/> — pytest (Python)
- <https://pkg.go.dev/testing> — Go standard library testing package
- <https://learn.microsoft.com/en-us/dotnet/core/testing/> — .NET unit testing (xUnit, NUnit, MSTest)
- <https://rspec.info/> — RSpec (Ruby)
- <https://doc.rust-lang.org/book/ch11-01-writing-tests.html> — Built-in tests in Rust
- <https://google.github.io/googletest/> — GoogleTest (C++)
- <https://phpunit.de/> — PHPUnit (PHP)
- Corpus lift: no language above ×1.3 (topic mass 37.09)

### mocking_and_fakes

Mocking libraries are central in Java (Mockito), Kotlin (MockK), C# (Moq), Python (unittest.mock) and JS/TS (Jest), where over-mocking and wrong-patch-target bugs are routine. Go favours hand-written fakes behind interfaces (gomock exists); Rust (mockall) and C++ (gMock) need trait/virtual seams, and C has little support.

- <https://site.mockito.org/> — Mockito (Java)
- <https://mockk.io/> — MockK (Kotlin)
- <https://github.com/devlooped/moq> — Moq (.NET)
- <https://docs.python.org/3/library/unittest.mock.html> — unittest.mock (Python standard library)
- <https://jestjs.io/docs/mock-functions> — Jest mock functions (JS/TS)
- <https://github.com/uber-go/mock> — gomock (Go)
- <https://docs.rs/mockall/latest/mockall/> — mockall (Rust), which requires trait-based seams
- <https://docs.phpunit.de/en/11.5/test-doubles.html> — PHPUnit test doubles
- Corpus lift: no language above ×1.3 (topic mass 29.65)

### flaky_tests

The main empirical flaky-test study is on Apache (Java) projects, with async waits, concurrency and test-order dependency as the top causes; these causes arise in every language with async/concurrent tests (Node async, Go goroutines, RSpec random order). Rust's ownership rules and C/C++/PHP's smaller test cultures make it less common as an exercise.

- <https://doi.org/10.1145/2635868.2635920> — Luo et al., An Empirical Analysis of Flaky Tests (FSE 2014): 51 Apache projects; async wait, concurrency, order dependency
- <https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html> — Google Testing Blog: flaky tests at Google and mitigation
- <https://go.dev/doc/articles/race_detector> — Go race detector, a common tool for timing-dependent test failures
- Corpus lift: Kotlin ×1.31 (topic mass 22.42)

### integration_tests

Java (Spring Boot tests, Testcontainers' origin) and Rails (integration/system tests built into the framework) are the canonical homes; Testcontainers modules for Go, .NET, Node, Python plus Django/Laravel test clients make the others common. Rust and C++ have thinner tooling, and C rarely has service-level integration suites.

- <https://testcontainers.com/> — Testcontainers: Java, Go, .NET, Node.js, Python, Rust and other implementations
- <https://guides.rubyonrails.org/testing.html> — Rails testing guide: integration and system tests
- <https://docs.djangoproject.com/en/stable/topics/testing/> — Django testing tools (test client, database setup)
- <https://github.com/testcontainers/testcontainers-rs> — Testcontainers for Rust (community)
- Corpus lift: no language above ×1.3 (topic mass 32.9)

## design

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| dependency_injection | **1** | .4 | **1** | **1** | .7 | .7 | **1** | .4 | .4 | .1 | .4 | .7 | **1** |
| layering | .7 | .4 | **1** | .7 | .7 | .7 | **1** | .7 | .4 | .1 | .4 | .4 | .7 |
| interface_design | .7 | .4 | **1** | .7 | **1** | .4 | **1** | .4 | **1** | .4 | .7 | .7 | .7 |
| coupling_and_cohesion | .7 | .7 | **1** | .7 | .7 | .7 | **1** | .7 | .4 | .4 | .7 | .4 | .7 |
| code_duplication | .7 | .7 | .7 | .7 | **1** | .7 | .7 | .7 | .4 | .7 | .4 | .4 | .7 |

### dependency_injection

DI containers are core framework features in Java (Spring), C# (Microsoft.Extensions.DependencyInjection), TypeScript (NestJS), PHP (Laravel's service container) and Kotlin (Koin, Spring, Dagger). Go (Wire, fx, constructor injection), Python (FastAPI Depends) and Scala (ZIO layers) are common; Ruby/JS lean on duck typing and module patching, and C rarely uses it.

- <https://docs.spring.io/spring-framework/reference/core/beans.html> — Spring IoC container (Java)
- <https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection> — .NET dependency injection
- <https://docs.nestjs.com/providers> — NestJS providers and DI (TypeScript)
- <https://laravel.com/docs/container> — Laravel service container (PHP)
- <https://insert-koin.io/> — Koin DI framework (Kotlin)
- <https://github.com/google/wire> — Wire: compile-time DI for Go
- <https://fastapi.tiangolo.com/tutorial/dependencies/> — FastAPI dependency injection (Python)
- <https://zio.dev/reference/di/> — ZIO dependency injection with layers (Scala)
- Corpus lift: no language above ×1.3 (topic mass 22.74)

### layering

Controller/service/repository layering is the default architecture in Spring and ASP.NET (with official guidance), and common in Nest, Django, Rails, Laravel and Go services. Plain JS, Rust, Scala and C/C++ code is less often organised around these layers, so violations look less natural.

- <https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures> — Microsoft guide to layered and clean architectures for .NET web apps
- <https://martinfowler.com/bliki/PresentationDomainDataLayering.html> — Fowler: presentation/domain/data layering
- <https://docs.spring.io/spring-framework/reference/core/beans.html> — Spring stereotypes (@Controller/@Service/@Repository) encode layering in Java
- Corpus lift: no language above ×1.3 (topic mass 29.04)

### interface_design

Explicit abstractions are central in Go (small implicit interfaces), Rust (traits), Java and C#; TypeScript, Kotlin, Scala, C++ and PHP interfaces/abstract classes are common. Python, Ruby and JS rely on duck typing (Protocols are optional), and C uses headers and function-pointer tables, so interface-design exercises are plausible but less natural there.

- <https://go.dev/doc/effective_go> — Effective Go: interfaces and embedding
- <https://doc.rust-lang.org/book/ch10-02-traits.html> — Rust book: traits as shared behaviour
- <https://learn.microsoft.com/en-us/dotnet/core/extensions/dependency-injection> — .NET DI built around interface abstractions
- Corpus lift: no language above ×1.3 (topic mass 34.01)

### coupling_and_cohesion

Largely language-neutral, but most discussed in large Java and C# codebases (OO design literature, DI-based decoupling). It is a common reading topic in the other mainstream backend languages and C++; Rust, Scala and C have smaller corpora of service code organised this way.

- <https://martinfowler.com/ieeeSoftware/coupling.pdf> — Fowler, Reducing Coupling (IEEE Software)
- <https://refactoring.com/catalog/> — Refactoring catalog (Move Function, Extract Class, etc.) for coupling and cohesion
- Corpus lift: no language above ×1.3 (topic mass 28.87)

### code_duplication

Copy-paste is language-neutral (PMD CPD detects it across most of these languages). Go gets 1.0 because it lacked generics until 1.18 and duplicated code is a well-known idiom cost there; C is also prone because it has no generics. Rust, C++ and Scala have strong abstraction tools (generics, macros, templates), so duplication is less often the point of an exercise.

- <https://pmd.github.io/pmd/pmd_userdocs_cpd.html> — PMD copy-paste detector, supporting most mainstream languages
- <https://go.dev/blog/intro-generics> — Go blog: generics introduced to avoid writing the same code per type
- <https://refactoring.com/catalog/> — Refactoring catalog: Extract Function and related duplication fixes
- Corpus lift: no language above ×1.3 (topic mass 23.27)

## distributed

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| sharding_and_partitioning | .4 | .4 | **1** | .4 | **1** | .4 | .4 | .4 | .7 | .7 | **1** | .7 | .1 |
| replication_and_consensus | .1 | .1 | **1** | .1 | **1** | .1 | .4 | .1 | **1** | .7 | .7 | .7 | · |
| cross_service_consistency | .7 | .4 | **1** | .7 | **1** | .7 | **1** | .4 | .4 | .1 | .1 | .7 | .4 |

### sharding_and_partitioning

Partitioning logic lives mostly in infrastructure: Kafka/Cassandra/Elasticsearch (Java), Vitess/CockroachDB (Go), ScyllaDB/MongoDB (C++), TiKV (Rust), Redis Cluster hash slots (C), Akka Cluster Sharding (Scala). App stacks (Rails horizontal sharding, Django routers) make it plausible elsewhere; PHP rarely.

- <https://vitess.io/docs/reference/features/sharding/> — Go: Vitess sharding.
- <https://github.com/cockroachdb/cockroach> — Go: range-partitioned distributed SQL.
- <https://www.scylladb.com/product/technology/shard-per-core-architecture/> — C++: ScyllaDB shard-per-core.
- <https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/> — C: Redis Cluster hash-slot partitioning.
- <https://doc.akka.io/libraries/akka-core/current/typed/cluster-sharding.html> — Scala/Java: Akka Cluster Sharding.
- <https://guides.rubyonrails.org/active_record_multiple_databases.html> — Ruby: application-level horizontal sharding exists but is less central.
- Corpus lift: Scala ×1.99, PHP ×1.75, C# ×1.48, C++ ×1.32 (topic mass 20.91)

### replication_and_consensus

Consensus implementations engineers actually read are etcd/raft and hashicorp/raft (Go), ZooKeeper/Kafka KRaft (Java), raft-rs/TiKV (Rust), braft (C++) and canonical/raft (C). Scala via Akka Cluster/Kafka. In TS/JS/Python/Ruby/PHP backends this is library-consumer territory, so code-reading exercises would look contrived.

- <https://github.com/etcd-io/raft> — Go: etcd's Raft library.
- <https://github.com/hashicorp/raft> — Go: HashiCorp Raft used by Consul/Nomad/Vault.
- <https://github.com/tikv/raft-rs> — Rust: Raft in TiKV.
- <https://zookeeper.apache.org/doc/current/zookeeperInternals.html> — Java: ZooKeeper atomic broadcast internals.
- <https://github.com/baidu/braft> — C++: industrial Raft library.
- <https://github.com/canonical/raft> — C: Raft implementation in C.
- Corpus lift: PHP ×2.52, Scala ×1.75, C ×1.51, C++ ×1.4, C# ×1.35 (topic mass 16.14)

### cross_service_consistency

Sagas and transactional outbox are microservice patterns with strong library support in Java (Debezium outbox, Axon/Eventuate), C# (MassTransit sagas and outbox) and Go (Temporal server, common in Go microservices); TS/Python/Kotlin/Scala are natural settings. Ruby/PHP monoliths meet it less, and C/C++ rarely.

- <https://microservices.io/patterns/data/transactional-outbox.html> — Pattern definition (transactional outbox).
- <https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html> — Java: Debezium outbox event router.
- <https://masstransit.io/documentation/patterns/saga> — C#: MassTransit saga state machines.
- <https://github.com/temporalio/temporal> — Go: Temporal durable workflow engine (SDKs in Go/Java/TS/Python/.NET).
- Corpus lift: no language above ×1.3 (topic mass 21.07)

## performance

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| profiling_and_hot_paths | .7 | .7 | **1** | .7 | **1** | .7 | .7 | .7 | **1** | **1** | **1** | .7 | .4 |

### profiling_and_hot_paths

Hot-path tuning is routine in C/C++/Rust infrastructure (perf, flame graphs), Go (pprof built in) and Java (async-profiler, JMH). Python (py-spy), C# (dotnet-trace), Node (--prof), Ruby (stackprof) and the JVM languages have well-known profilers. PHP has Xdebug/Blackfire/Tideways, but request-scoped PHP code is less often tuned at the hot-loop level.

- <https://www.brendangregg.com/flamegraphs.html> — Flame graphs for CPU profiling (perf, many runtimes)
- <https://pkg.go.dev/net/http/pprof> — Go built-in pprof profiling
- <https://github.com/async-profiler/async-profiler> — JVM sampling profiler
- <https://github.com/flamegraph-rs/flamegraph> — Rust flamegraph tooling
- <https://github.com/benfred/py-spy> — Python sampling profiler
- <https://xdebug.org/docs/profiler> — PHP Xdebug profiler
- Corpus lift: PHP ×1.63, C++ ×1.41 (topic mass 35.05)

## integrations

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| webhooks_outbound | **1** | .7 | .7 | .4 | .7 | .7 | .7 | **1** | .7 | · | .1 | .4 | .7 |
| third_party_adapters | **1** | .7 | .7 | .4 | .7 | **1** | .7 | .7 | .4 | .1 | .1 | .4 | .7 |

### webhooks_outbound

Sending webhooks (retries, signing, timeouts, SSRF) is product-API work: TS/Node and Ruby (Rails SaaS) are the typical homes, with dedicated dispatchers like Svix (Rust) and Convoy (Go) and spatie/laravel-webhook-server for PHP. C/C++ services essentially never send webhooks.

- <https://www.standardwebhooks.com/> — Cross-language spec for signing/delivering webhooks, with libraries in many languages.
- <https://github.com/svix/svix-webhooks> — Rust: Svix webhook delivery server; SDKs for many languages.
- <https://github.com/frain-dev/convoy> — Go: Convoy webhook gateway.
- <https://github.com/spatie/laravel-webhook-server> — PHP: outbound webhooks with retries and signing for Laravel.
- Corpus lift: TypeScript ×1.42, Go ×1.37 (topic mass 12.25)

### third_party_adapters

Wrapping payment/email/CRM APIs is glue work; vendors like Stripe ship official SDKs for Node, Python, Ruby, PHP, Java, Go and .NET, and Resilience4j/Polly exist for the retry/timeout wrapping. Kotlin/Scala/Rust get unofficial or JVM SDKs, and C/C++ backends rarely integrate SaaS APIs.

- <https://docs.stripe.com/sdks> — Official server SDK languages for a major third-party API.
- <https://resilience4j.readme.io/docs> — Java: resilience library for wrapping remote calls.
- <https://github.com/App-vNext/Polly> — C#: Polly retry/circuit-breaker for external calls.
- Corpus lift: no language above ×1.3 (topic mass 24.32)

## realtime

| topic | TS | JS | Java | Kt | Go | Py | C# | Rb | Rs | C | C++ | Sc | PHP |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| connection_fanout | **1** | **1** | .7 | .4 | **1** | .7 | .7 | .7 | .7 | .1 | .4 | .4 | .4 |

### connection_fanout

Broadcasting to many WebSocket clients is the core use case of Node (socket.io rooms, Redis adapter, ws) and Go (gorilla/websocket hub). It is common in Java (Spring STOMP), C# (SignalR backplanes), Python (Django Channels groups), Ruby (Action Cable) and Rust (tokio broadcast). C++ (uWebSockets), Kotlin (Ktor), Scala and PHP (Laravel broadcasting via an external server) are thinner, and C is rare.

- <https://socket.io/docs/v4/broadcasting-events/> — socket.io broadcasting to rooms
- <https://socket.io/docs/v4/redis-adapter/> — Fan-out across Node instances via Redis
- <https://github.com/gorilla/websocket> — Go WebSocket library (chat hub example)
- <https://learn.microsoft.com/en-us/aspnet/core/signalr/scale> — SignalR scale-out and backplanes
- <https://channels.readthedocs.io/en/latest/topics/channel_layers.html> — Django Channels group fan-out
- <https://guides.rubyonrails.org/action_cable_overview.html> — Rails Action Cable broadcasting
- <https://docs.rs/tokio/latest/tokio/sync/broadcast/index.html> — tokio broadcast channel for fan-out
- <https://laravel.com/docs/11.x/broadcasting> — Laravel broadcasting relies on an external WebSocket server
- Corpus lift: C# ×3.35, TypeScript ×1.73, Kotlin ×1.5, C++ ×1.5, JavaScript ×1.44 (topic mass 8.15)
