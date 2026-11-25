// Generate the example bank from a master plan. For each (topic, language) target, examples already in
// --out count toward it (read from each folder's public.json), and only the shortfall is generated.
// New examples go to <out>/<topic>.<language>.<k>/ (e.g. api-idempotency.python.1), where k counts that
// pair's examples, so names never collide with existing folders and an interrupted run resumes.
//
// Two ways to produce the model's part (the "draft"):
//   --mode api       call the Claude API directly (needs ANTHROPIC_API_KEY)
//   --mode prepare   write one job file per example to <out>/.work/jobs/<name>.json with the system prompt,
//                    user message, language and defect decision. Run the prompt elsewhere (e.g. Claude Code
//                    subagents) and save its JSON output to <out>/.work/drafts/<name>.json (draftSchema shape).
//   --mode assemble  validate each draft (including that it is in the requested language) and write the example.
//
// --languages Python,Java limits the run to those languages (e.g. the most demanded ones first).
//
// Usage: node --env-file-if-exists=.env pipeline/src/generateBank.ts --mode <api|prepare|assemble>
//            --plan <master.json> --taxonomy <taxonomy.json> --out <dir> [--languages <a,b>] [--limit <n>] [--concurrency <n>]

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { Plan, Taxonomy, type LabelId } from "../../shared/types.ts";
import { SYSTEM_PROMPT, exampleFromDraft, generateExample, prepareRequest, writeExample } from "./exampleGenerator.ts";

const MAX_ATTEMPTS = 3; // api mode: generation can fail validation (e.g. a defect snippet that doesn't match)

const { values } = parseArgs({
    options: {
        mode: { type: "string", default: "api" },
        plan: { type: "string" },
        taxonomy: { type: "string" },
        out: { type: "string" },
        languages: { type: "string" },
        limit: { type: "string" },
        concurrency: { type: "string", default: "4" },
    },
});

if (!values.plan || !values.taxonomy || !values.out) {
    console.error("Usage: node pipeline/src/generateBank.ts --mode <api|prepare|assemble> --plan <master.json> --taxonomy <taxonomy.json> --out <dir> [--languages <a,b>] [--limit <n>] [--concurrency <n>]");
    process.exit(1);
}
const plan = Plan.parse(JSON.parse(readFileSync(values.plan, "utf8")));
const taxonomy = Taxonomy.parse(JSON.parse(readFileSync(values.taxonomy, "utf8")));
if (taxonomy.version !== plan.taxonomyVersion) throw new Error(`plan uses taxonomy ${plan.taxonomyVersion}, but --taxonomy is ${taxonomy.version}`);
const out = values.out;
const jobsDir = path.join(out, ".work", "jobs");
const draftsDir = path.join(out, ".work", "drafts");

// What the bank already has, per (topic, language): every example folder under --out with a public.json.
const pairKey = (label: string, language: string) => `${label}|${language}`;
const have = new Map<string, number>();
for (const entry of existsSync(out) ? readdirSync(out, { withFileTypes: true }) : []) {
    const pub = path.join(out, entry.name, "public.json");
    if (!entry.isDirectory() || !existsSync(pub)) continue;
    const { concepts, language, questions } = JSON.parse(readFileSync(pub, "utf8")) as { concepts: string[]; language: string; questions: { kind?: string }[] };
    if (questions.some((q) => q.kind === "fix")) continue; // runnable bug-fix exercises are counted separately (pipeline/RUNNABLE.md)
    const key = pairKey(concepts[0], language);
    have.set(key, (have.get(key) ?? 0) + 1);
}

// The shortfall as named jobs: <topic>.<language>.<k> for k = have+1 .. count.
const onlyLanguages = values.languages?.split(",").map((l) => l.trim().toLowerCase());
const slug = (s: string) => s.toLowerCase().replace(/\+/g, "p").replace(/#/g, "sharp").replace(/[^a-z0-9]+/g, "_");
const pending = plan.targets
    .filter((t) => !onlyLanguages || onlyLanguages.includes(t.language.toLowerCase()))
    .flatMap((t) => {
        const already = have.get(pairKey(t.label, t.language)) ?? 0;
        return Array.from({ length: Math.max(0, t.count - already) }, (_, i) => {
            const k = already + i + 1;
            const name = `${t.label.replace(/^backend\./, "").replaceAll(".", "-")}.${slug(t.language)}.${k}`;
            return { label: t.label, language: t.language, k, name, dir: path.join(out, name) };
        });
    })
    .filter((j) => !existsSync(path.join(j.dir, "public.json")));
const limit = values.limit ? Number(values.limit) : undefined;
const planned = plan.targets.reduce((s, t) => s + t.count, 0);

type Job = { label: LabelId; language: string; withDefect: boolean; scenario: string; system: string; user: string };

// Business domains, rotated within each topic so examples of the same concept differ.
const SCENARIOS = [
    "payments and billing", "e-commerce orders and inventory", "ride sharing and dispatch", "food delivery",
    "messaging and notifications", "social feed and content", "video streaming", "file storage and sync",
    "search and indexing", "ads and analytics", "healthcare scheduling", "banking and ledgers",
    "logistics and shipping", "developer platform and CI", "identity and access", "IoT telemetry",
    "travel booking", "multiplayer game backend", "customer support ticketing", "HR and payroll",
];

// A business domain for the k-th example of a (topic, language) pair: rotated by k, offset per pair
// so pairs don't all start with the same domain.
function scenarioFor(label: string, language: string, k: number): string {
    let h = 0;
    for (const ch of `${label}|${language}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return SCENARIOS[(h + k - 1) % SCENARIOS.length];
}

if (values.mode === "prepare") {
    mkdirSync(jobsDir, { recursive: true });
    const todo = pending.filter((j) => !existsSync(path.join(jobsDir, `${j.name}.json`))).slice(0, limit);
    for (const j of todo) {
        const scenario = scenarioFor(j.label, j.language, j.k);
        const { withDefect, userContent } = prepareRequest(j.label, taxonomy, { scenario, language: j.language });
        const job: Job = { label: j.label, language: j.language, withDefect, scenario, system: SYSTEM_PROMPT, user: userContent };
        writeFileSync(path.join(jobsDir, `${j.name}.json`), JSON.stringify(job, null, 2) + "\n");
    }
    console.log(`${planned} examples in plan, ${pending.length} missing; wrote ${todo.length} job files to ${jobsDir}`);
} else if (values.mode === "assemble") {
    let ok = 0;
    const failed: string[] = [];
    for (const j of pending.slice(0, limit)) {
        const draftFile = path.join(draftsDir, `${j.name}.json`);
        const jobFile = path.join(jobsDir, `${j.name}.json`);
        if (!existsSync(draftFile) || !existsSync(jobFile)) continue;
        try {
            const job: Job = JSON.parse(readFileSync(jobFile, "utf8"));
            const example = exampleFromDraft(JSON.parse(readFileSync(draftFile, "utf8")), job.label, taxonomy, job.withDefect);
            if (example.public.language.toLowerCase() !== job.language.toLowerCase()) {
                throw new Error(`draft is in ${example.public.language}, job asked for ${job.language}`);
            }
            await writeExample(example, j.dir);
            ok++;
            console.log(`✓ ${j.name}`);
        } catch (err) {
            failed.push(j.name);
            console.warn(`✗ ${j.name}: ${(err as Error).message}`);
        }
    }
    console.log(`assembled ${ok}, failed ${failed.length}${failed.length ? ": " + failed.join(", ") : ""}`);
} else if (values.mode === "api") {
    const todo = pending.slice(0, limit);
    console.log(`${planned} examples in plan, ${pending.length} missing, ${todo.length} to generate this run`);
    let next = 0;
    let ok = 0;
    const failed: string[] = [];
    const worker = async () => {
        while (next < todo.length) {
            const j = todo[next++];
            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                try {
                    await writeExample(await generateExample(j.label, taxonomy, { language: j.language, scenario: scenarioFor(j.label, j.language, j.k) }), j.dir);
                    ok++;
                    console.log(`✓ ${j.name}`);
                    break;
                } catch (err) {
                    const msg = (err as Error).message;
                    console.warn(`✗ ${j.name} attempt ${attempt}: ${msg}`);
                    if (/authentication|api key|apiKey/i.test(msg)) throw err; // retrying can't fix missing credentials
                    if (attempt === MAX_ATTEMPTS) failed.push(j.name);
                }
            }
        }
    };
    await Promise.all(Array.from({ length: Math.max(1, Number(values.concurrency)) }, worker));
    console.log(`done: ${ok} written, ${failed.length} failed${failed.length ? ": " + failed.join(", ") : ""}`);
} else {
    throw new Error(`Unknown --mode ${values.mode} (api, prepare, assemble)`);
}
