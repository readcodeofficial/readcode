# Key files

The files that hold the product's logic and data contracts. Most other files are UI (pages, components,
styling) and can change freely; these deserve care, review, and a note when they change.

## Data contracts

| File | What it defines | Change it when |
|---|---|---|
| `shared/types.ts` | Zod schemas for the example format (questions, answer key, files), plans, taxonomy. Used by the pipeline and the web app. | The question format or plan shape changes. Also update the generator prompt and the viewer (see `CLAUDE.md`). |
| `pipeline/taxonomy/v*.json` | The concept labels everything is classified against. | Adding or renaming concepts. Bump the version instead of editing in place. |
| `pipeline/taxonomy/language_fit.json` | Per topic, how well each language suits an exercise on it (0–1), with rationale and sources. Planning only gives a topic languages with fit ≥ 0.7. | The research changes, or the taxonomy gets new labels (every label needs a row). Regenerate `docs/LANGUAGE_FIT.md` with `pipeline/src/languageFitDoc.ts`. |

## Pipeline: posting → plan → examples

| File | Role |
|---|---|
| `pipeline/src/classifier.ts` | The classifier prompt: weights a job posting against the taxonomy. |
| `pipeline/src/pipeline.ts` | `planFromClassification`: turns weights into a plan (which topics, how many examples each, in which languages). |
| `pipeline/src/plan.ts` | Builds plans from saved classifier weights (`postings/plans/weights/` → `plans/`); `--fit` applies the language fit table. |
| `pipeline/src/languageLift.ts` | Corpus evidence for the fit table: how often each language co-occurs with each topic in the postings (`docs/language_lift.json`). |
| `pipeline/src/exampleGenerator.ts` | The example-generation prompt, and validation of a generated draft into the example format. |
| `pipeline/src/generateBank.ts` | Runs generation for a whole plan (API, or prepare/assemble for subagents). |
| `pipeline/src/checkRunnable.ts` | Verifies runnable exercises (tests fail on the bug, pass with the fix) and writes authored ones into the bank; see `pipeline/RUNNABLE.md`. |
| `pipeline/src/floorPlan.ts` | Builds `postings/plans/floor.json`: the extra examples that bring every topic up to a minimum count, in languages with fit ≥ 0.7. |

## Data (generated, committed)

| Path | Contents |
|---|---|
| `postings/jobs.json` | The 94 job postings. Descriptions were partly pasted by hand, so don't regenerate it blindly. |
| `postings/plans/` | Classifier weights and plans per posting; `master.json` drives the example bank. |
| `examples/NNN-<topic>/` | The example bank: `public.json`, `key.json`, `src/**`. |

## Web app: the parts with logic

| File | Role |
|---|---|
| `web/lib/examples.ts` | Reads examples from disk. |
| `web/lib/jobs.ts` | Matches each posting's plan to bank examples (coverage, per-topic examples). |
| `web/app/examples/[name]/ExampleViewer.tsx` | Answering and grading questions (locate-the-defect, multiple choice, runnable fix). |
| `shared/runTests.ts` | Runs a fix question's tests (TypeScript/JavaScript, Python, Go, Java) and reports per-test results. Used by the web app's server action and by `pipeline/src/checkRunnable.ts`. Local dev only: no sandbox. |

## Coming with Postgres

| File | Role |
|---|---|
| `web/db/schema.ts` | Database tables (Drizzle). The source of truth for stored data; `jsonb` columns reuse types from `shared/types.ts`. |
| `web/drizzle/` | Generated migrations. Review, never hand-edit. |
| `web/lib/auth.ts` | Accounts and sessions. |
| `web/app/actions/` | Server actions that write data (submit an answer, create a plan). Grading moves here. |

## Everything else

Pages, components, styling, fonts and logos under `web/app/` and `web/components/` are presentation.
Change them as needed; they hold no data rules.
