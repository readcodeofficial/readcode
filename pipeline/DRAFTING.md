# Drafting examples with subagents (no API)

Generating examples without the Claude API: `generateBank.ts --mode prepare` writes job files, Claude Code
subagents act as the model and write drafts, `--mode assemble` validates the drafts into examples.

## 1. Prepare the jobs

```
node pipeline/src/generateBank.ts --mode prepare --plan postings/plans/master.json \
  --taxonomy pipeline/taxonomy/v0.1.0.json --out examples [--languages Python,Java,TypeScript,Go]
```

Writes one job file per missing example to `examples/.work/jobs/<name>.json`. To give every topic a minimum number of examples
(including topics the master plan leaves out), build a floor plan first and use it as `--plan`:

```
node pipeline/src/floorPlan.ts --taxonomy pipeline/taxonomy/v0.1.0.json --fit pipeline/taxonomy/language_fit.json \n  --plan postings/plans/master.json --examples examples --min 2 --out postings/plans/floor.json
```

Run assemble with the same `--plan` you prepared with. Give each drafting subagent its own scratch folder: parallel
agents sharing one folder have overwritten each other's helper scripts.

## 2. Draft (prompt for the main Claude session)

> Follow `pipeline/DRAFTING.md` section 3: draft every job in `examples/.work/jobs/` that has no draft in
> `examples/.work/drafts/` yet, using general-purpose subagents on Sonnet, 8 jobs per subagent, in parallel.

The main session lists the jobs without drafts, splits them into groups of 8, and launches one subagent per
group with the instructions in section 3 and its list of job names.

## 3. Instructions for each subagent

You replace a Claude API call. For EACH job name you were given:

1. Read `examples/.work/jobs/<job>.json`. Fields:
   - `system`: your instructions. Follow them exactly, as if they were your system prompt.
   - `user`: the user message (target concept, language, whether to include a defect, scenario, allowed labels).
   - `language`: the code, the draft's `language` field and the questions must all be in this language.
   - `withDefect`: must match whether you report a defect.
2. Write one draft per job, independently: don't copy code, names or defects between jobs.
3. Save it to `examples/.work/drafts/<job>.json` with exactly this shape (write it with a script, e.g.
   Python `json.dump`, so escaping is correct):

```
{
  "title": string,
  "name": string,                                           // 2-4 words, no hint of any defect
  "language": string,                                       // exactly the job's language
  "durationMinutes": number,
  "files": [{"path": string, "content": string}],          // relative paths, full code
  "defect": {"path": string, "snippet": string} | null,     // snippet copied EXACTLY from that file, occurs exactly once; null iff withDefect is false
  "locateQuestion": {"prompt": string, "explanation": string},
  "choiceQuestions": [{"prompt": string, "choices": [4 strings], "answer": number, "explanation": string}],  // exactly 3, answer = 0-based index
  "concepts": [string]                                       // only labels from the user message's <labels> list
}
```

4. Verify every draft with a script: JSON parses; `language` equals the job's language; `name` is 2-4 words;
   exactly 3 choiceQuestions, each with 4 choices and a valid answer index; `defect` is non-null exactly when
   `withDefect` is true; if non-null, `defect.snippet` occurs exactly once in the file at `defect.path`; every
   concept is in the job's label list. Fix and rewrite anything that fails.

Don't touch any other files. Reply with one line per job: job name, name, defect location or "no defect".

## 4. Assemble

```
node pipeline/src/generateBank.ts --mode assemble --plan postings/plans/master.json \
  --taxonomy pipeline/taxonomy/v0.1.0.json --out examples [--languages ...]
```

Validates each draft and writes `examples/<topic>.<language>.<k>/`. Drafts that fail are listed; fix or
re-draft them and run assemble again. Everything resumes: finished examples and existing drafts are skipped.
