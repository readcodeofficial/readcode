# Runnable (bug-fix) exercises

A runnable exercise is one `fix` question: a small, realistic codebase with **one** bug, a symptom report, and a
test suite. The candidate edits one file in the browser and runs the tests (`shared/runTests.ts`, local dev only)
until they all pass. These are counted separately from comprehension examples: `generateBank.ts` and
`floorPlan.ts` ignore them.

Languages with a runner (standard toolchains only, nothing to install): **TypeScript, JavaScript, Python, Go, Java**.

## Authoring format

Write each exercise as a folder `examples/.work/runnable/<topic>.<language>.fix.<k>/` (e.g.
`concurrency-race_conditions.go.fix.1`), then verify it and write it into the bank with `checkRunnable.ts`.

```
meta.json
src/**        the code as the candidate sees it, WITH the bug
tests/**      6-8 tests (layout per language below)
fix/<path>    optional: the full fixed version of the editable file (path relative to src/)
```

```json
{
  "title": "What the code is and the kind of problem, without naming the exact line",
  "name": "2-4 word name",
  "language": "Go",
  "durationMinutes": 20,
  "concepts": ["backend.<target topic>", "...up to 2 more related labels from pipeline/taxonomy/v0.1.0.json"],
  "fix": {
    "prompt": "Symptom report as on-call/support would describe it, then 'Fix <file> so the tests pass.' Don't say which line or what the bug is.",
    "editable": ["path/relative/to/src"],
    "patch": [["exact text in the editable file", "replacement"]],
    "explanation": "3-5 sentences: what the bug is, why it causes the symptom, what the fix does and why it's right."
  }
}
```

- Use **either** `patch` (each `from` appears exactly once in the editable file) **or** a full `fix/<path>` file.
- `concepts[0]` is the target topic. `durationMinutes`: 18-22.

## The code

- **100-220 lines across 3-5 files**, production-style backend code in a concrete business domain.
- **Exactly one bug**, in the one editable file, about the **target topic**, and it must be the kind of mistake that
  is natural *in this language* (its concurrency primitives, error model, standard library behaviour). Subtle,
  realistic, findable by careful reading plus the failing tests.
- The rest of the code is correct and uses the buggy part, so the bug also shows up through it.
- **Standard library only** (the tests really run, offline): no npm/pip/Go modules/Maven packages. Model databases,
  brokers, HTTP services, clocks etc. as small in-memory fakes passed in as parameters, the way production code
  would take an interface.
- No comments that give the bug away.

## Tests per language

Every runner reports each test by name; failures show the assertion message, so make messages say what went wrong.

| Language | Layout | Notes |
|---|---|---|
| TypeScript | `tests/<name>.test.ts`, `import { test } from "node:test"`, `node:assert/strict`, import code as `../src/x.ts` | Node 26 strips types: no `enum`, `namespace`, parameter properties; `import type` for types; `.ts` extensions |
| JavaScript | `tests/<name>.test.js` (ESM `import`, explicit `.js` extensions) | same as TypeScript otherwise |
| Python | `tests/test_<name>.py`, `unittest.TestCase`; `src/` is on `sys.path`, so `from billing.ledger import Ledger` | Python 3.14 |
| Go | code in `src/<pkg>/*.go` (`package <pkg>`); tests in `tests/*_test.go`, `package tests`, `import "exercise/src/<pkg>"` | module is `exercise` (go 1.23 semantics: per-iteration loop variables); black-box tests, so test the exported API |
| Java | code in `src/<package dirs>/*.java` with `package` declarations; tests in `tests/<package dirs>/<Name>Test.java` | JDK 21. No JUnit: test classes are `public`, have a public no-arg constructor and `public void testXxx()` methods; optional `public void setUp()` runs before each. Assertions: `import static readcode.Assert.*;` (below) |

`readcode.Assert` (Java): `assertEquals(expected, actual[, message])` (objects, longs), `assertEquals(double, double,
delta)`, `assertTrue/assertFalse(cond[, message])`, `assertNull`, `assertNotNull`, `fail(message)`,
`<T> T assertThrows(Class<T>, () -> { ... })`.

- **6-8 tests.** On the buggy code at least 2 fail and at least 1 passes; on the fixed code all pass. Tests must
  compile/import against both versions.
- **Deterministic and fast** (well under the runner timeouts: 20s for Node/Python, 45s Java, 90s Go including
  compilation): no randomness, no real clock (inject one), no network. If the bug could hang (deadlock, leak),
  bound the wait inside the test and fail with a clear message.
- One test should print something useful for the candidate (shown in the output panel).

## Verify and write

```
node pipeline/src/checkRunnable.ts --gen examples/.work/runnable --filter <folder name>
node pipeline/src/checkRunnable.ts --gen examples/.work/runnable --write --out examples
node pipeline/src/checkRunnable.ts --examples examples        # re-check every runnable exercise in the bank
```

`OK` means: some tests fail on the bug, all pass with the fix, 6-8 tests. `BAD` prints the reason and the runs'
output.
