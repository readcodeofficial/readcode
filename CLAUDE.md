# readcode

Code-reading practice for backend interviews: job postings → topic plans → example bank → web viewer.

## Flow
1. `postings/jobs.json`: 94 postings, scraped once from public job boards; descriptions were partly pasted by hand, so treat it as the source of truth.
2. Classify each posting against the taxonomy (`pipeline/taxonomy/v0.1.0.json`, prompt in `pipeline/src/classifier.ts`) → `postings/plans/weights/NNN.json` → `plan.ts --fit pipeline/taxonomy/language_fit.json` → `plans/NNN.json` (NNN = 1-based posting index; targets are `{ label, language, count }`). A topic only gets the posting's languages that suit it (fit ≥ 0.7; research and sources in `docs/LANGUAGE_FIT.md`). `combinePlans.ts` → `plans/master.json`: for each (topic, language), the largest count any plan asks for. Pipeline scripts take all inputs and outputs as arguments (run one without arguments for usage).
3. `pipeline/src/generateBank.ts` turns the master plan into `examples/NNN-<topic>/` (`public.json`, `key.json`, `src/**`). `floorPlan.ts` → `plans/floor.json` tops every taxonomy topic up to a minimum (currently 2) in its best-fitting languages, including topics no posting asked for; run `generateBank.ts` with `--plan postings/plans/floor.json` to fill it.
4. `web/` (Next.js) reads `examples/` and `postings/` from disk. Run: `cd web && npm run dev`.

## Example format
- Schema: `shared/types.ts` (zod). `ExamplePublic` is shown to the candidate; `ExampleKey` holds the answers and explanations.
- 4 questions: Q1 is "locate the defect" (line range, or no defect); Q2–4 are multiple choice.
- The prompt (`SYSTEM_PROMPT` in `pipeline/src/exampleGenerator.ts`) does most of the work. The model returns a `Draft`, and `exampleFromDraft` validates it and converts it to the schema (e.g. the quoted defect snippet becomes a line range).

## Changing the question format = 3 places
1. Schema: `shared/types.ts`
2. Prompt + draft schema + `exampleFromDraft`: `pipeline/src/exampleGenerator.ts`
3. Renderer: `web/app/examples/[name]/ExampleViewer.tsx`

Then regenerate the examples, or migrate the existing ones.

## Generating without the API
There's no API key; Claude Code subagents act as the model.
`generateBank.ts --mode prepare` writes the jobs to `examples/.work/jobs/`. Subagents follow `pipeline/DRAFTING.md` and write drafts to `examples/.work/drafts/`. `--mode assemble` validates the drafts and writes the examples. `.work/` is gitignored.

## Known gaps
- No one has reviewed the examples for correctness, and some defect patterns repeat within topics.
- Not built yet: a no-reuse registry, sourcing from open-source repos, runnable examples, free-text answers with model grading, saved progress.
- Examples live as files in git for now; a database is planned once the schema settles.
