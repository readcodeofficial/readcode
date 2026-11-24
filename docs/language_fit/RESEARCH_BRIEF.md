# Language fit research brief

Goal: for every taxonomy topic, how natural is each of our 13 languages as the setting for a
code-reading exercise about that topic, in **backend / server-side work**? The plan uses this so that
e.g. an N+1-query exercise is never generated in C, and a memory-leak exercise favours languages where
engineers actually hunt leaks.

Languages (exact spelling): TypeScript, JavaScript, Java, Kotlin, Go, Python, C#, Ruby, Rust, C, C++, Scala, PHP

## Scale (use these anchors; be consistent across topics)

- **1.0** — a mainstream home of this topic: engineers in this language meet it routinely, and there are
  well-known libraries, frameworks, runtime features or canonical bug classes for it in this language.
- **0.7** — common: a natural setting, regularly discussed for this language.
- **0.4** — plausible: happens in backend work in this language but it isn't where most people meet it,
  or the ecosystem support is thin.
- **0.1** — rare: would look contrived as an exercise in this language.
- **0** — doesn't really arise (no ecosystem for it, or the language makes it impossible/irrelevant).

Rules:
- Score the topic as it shows up in **backend services** (APIs, workers, data pipelines, infrastructure
  software). C/C++/Rust count for infrastructure software too (databases, proxies, storage engines,
  brokers, runtimes), not only web apps.
- Every topic must have **at least 3 languages at ≥ 0.7**.
- Don't score from popularity alone: a topic can be 1.0 in a less popular language (e.g. memory leaks in C).
  Popularity is already handled elsewhere (by the job postings).
- Language-specific mechanisms matter: e.g. async/await pitfalls need async/await (or an equivalent
  futures model); "ORM pitfalls" needs mainstream ORMs; atomic operations are first-class in C/C++/Rust/Go/Java.

## Evidence

For each topic give **at least 2 sources** that justify the high and the low scores, preferring:
- official docs / well-known libraries per language (e.g. Hibernate, SQLAlchemy, ActiveRecord, EF Core,
  Eloquent, GORM, Prisma for ORMs; tokio, asyncio, CompletableFuture for async),
- language-level references (memory models, concurrency primitives),
- well-known engineering articles or postmortems,
- surveys only for general context (Stack Overflow Developer Survey 2024/2025, GitHub Octoverse,
  JetBrains State of Developer Ecosystem).

Use web search to find and check real URLs. Don't invent URLs; if you can't verify one, leave it out.

You can also consult `docs/language_lift.json` in the repo: corpus evidence from our 94 job postings
(lift > 1 means that language co-occurs with the topic more than its baseline). It is sparse for C#, PHP,
C, Scala and Kotlin, so treat it as a secondary signal.

## Output

Write `docs/language_fit/<group>.json` (your group id is in your prompt), exactly:

```json
{
  "group": "g1",
  "topics": {
    "backend.concurrency.race_conditions": {
      "weights": { "TypeScript": 0.4, "JavaScript": 0.4, "Java": 1.0, "Kotlin": 0.7, "Go": 1.0, "Python": 0.7, "C#": 0.7, "Ruby": 0.4, "Rust": 0.7, "C": 1.0, "C++": 1.0, "Scala": 0.7, "PHP": 0.1 },
      "rationale": "1-3 sentences: why the high languages are high and the low ones low.",
      "sources": [
        { "url": "https://...", "supports": "what this source shows, briefly" }
      ]
    }
  }
}
```

- All 13 languages present for every topic, values in {0, 0.1, 0.4, 0.7, 1.0}.
- Every topic listed in `docs/language_fit/<group>.labels.txt` must appear, and nothing else.
- Validate the file with a script before you finish (JSON parses, every label, all 13 languages,
  allowed values, ≥3 languages at ≥0.7, ≥2 sources each).

Only write that one file. Reply with a short summary: notable judgment calls and any topic where the
evidence was thin.
