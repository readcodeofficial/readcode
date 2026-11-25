// Verify runnable (bug-fix) exercises with the same runner the web app uses (shared/runTests.ts): the tests
// must fail on the code as given and all pass with the reference fix. Optionally build exercises from the
// authoring format and write them into the bank.
//
// Authoring format (one folder per exercise, named <topic>.<language>.fix.<k>):
//   meta.json  { title, name, language, durationMinutes, concepts: [target, ...],
//                fix: { prompt, editable: [path], explanation, patch?: [[from, to], ...] } }
//   src/**     the code as the candidate sees it, with the bug
//   tests/**   the test suite (layout per language: see shared/runTests.ts)
//   fix/**     optional full fixed versions of the editable files (else `patch` is applied to them)
//
// Usage:
//   node pipeline/src/checkRunnable.ts --examples <dir> [--filter <substring>]          re-check the bank's runnable exercises
//   node pipeline/src/checkRunnable.ts --gen <dir> [--filter <s>] [--write --out <dir>] check (and write) authored exercises
// Options: --tests <min>-<max> (default 6-8) for --gen; --concurrency <n> (default 3).

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { runTests } from "../../shared/runTests.ts";
import { ExampleKey, ExamplePublic, type RunResult, type SourceFile } from "../../shared/types.ts";

const USAGE =
    "Usage: node pipeline/src/checkRunnable.ts (--examples <dir> | --gen <dir> [--write --out <dir>]) [--filter <s>] [--tests 6-8] [--concurrency 3]";
const { values } = parseArgs({
    options: {
        examples: { type: "string" },
        gen: { type: "string" },
        write: { type: "boolean", default: false },
        out: { type: "string" },
        filter: { type: "string", default: "" },
        tests: { type: "string", default: "6-8" },
        concurrency: { type: "string", default: "3" },
    },
});
if (!values.examples === !values.gen || (values.write && !values.out)) {
    console.error(USAGE);
    process.exit(1);
}
const [minTests, maxTests] = values.tests!.split("-").map(Number);

const walk = (dir: string, base = dir): SourceFile[] =>
    !existsSync(dir)
        ? []
        : readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
              const p = path.join(dir, e.name);
              return e.isDirectory() ? walk(p, base) : [{ path: path.relative(base, p).replaceAll("\\", "/"), content: readFileSync(p, "utf8") }];
          });

type Exercise = {
    name: string;
    language: string;
    src: SourceFile[]; // paths relative to src/
    tests: SourceFile[]; // paths relative to tests/
    solution: SourceFile[]; // fixed editable files, paths relative to src/
    build?: () => { pub: ExamplePublic; key: ExampleKey }; // --gen only
};

const run = (ex: Exercise, src: SourceFile[]): Promise<RunResult> =>
    runTests(
        ex.language,
        [...src.map((f) => ({ path: `src/${f.path}`, content: f.content })), ...ex.tests.map((f) => ({ path: `tests/${f.path}`, content: f.content }))],
        ex.tests.map((f) => `tests/${f.path}`),
    );

// ---- load ----

function fromBank(dir: string, name: string): Exercise | null {
    const pub = ExamplePublic.parse(JSON.parse(readFileSync(path.join(dir, name, "public.json"), "utf8")));
    const qi = pub.questions.findIndex((q) => q.kind === "fix");
    if (qi < 0) return null;
    const q = pub.questions[qi];
    if (q.kind !== "fix") return null;
    const key = ExampleKey.parse(JSON.parse(readFileSync(path.join(dir, name, "key.json"), "utf8")));
    const answer = key.answers[qi];
    if (typeof answer !== "object" || !("solution" in answer)) throw new Error(`${name}: answer ${qi} has no solution`);
    return { name, language: pub.language, src: walk(path.join(dir, name, "src")), tests: q.tests, solution: answer.solution };
}

function fromGen(dir: string, name: string): Exercise {
    const g = path.join(dir, name);
    const meta = JSON.parse(readFileSync(path.join(g, "meta.json"), "utf8"));
    const src = walk(path.join(g, "src"));
    const tests = walk(path.join(g, "tests"));
    const solution: SourceFile[] = meta.fix.editable.map((p: string) => {
        const fixed = path.join(g, "fix", p);
        if (existsSync(fixed)) return { path: p, content: readFileSync(fixed, "utf8") };
        let content = src.find((f) => f.path === p)?.content;
        if (content === undefined) throw new Error(`${name}: editable ${p} is not in src/`);
        for (const [from, to] of (meta.fix.patch ?? []) as [string, string][]) {
            if (content.split(from).length !== 2) throw new Error(`${name}: patch text must appear exactly once in ${p}: ${from.slice(0, 60)}`);
            content = content.replace(from, () => to);
        }
        return { path: p, content };
    });
    const build = () => {
        const pub = ExamplePublic.parse({
            id: meta.id ?? randomUUID(),
            title: meta.title,
            name: meta.name,
            createdAt: new Date().toISOString(),
            durationMinutes: meta.durationMinutes,
            language: meta.language,
            questions: [{ kind: "fix", prompt: meta.fix.prompt, editable: meta.fix.editable, tests }],
            taxonomyVersion: meta.taxonomyVersion ?? "0.1.0",
            concepts: meta.concepts,
        });
        const key = ExampleKey.parse({ answers: [{ solution }], explanations: [meta.fix.explanation] });
        return { pub, key };
    };
    return { name, language: meta.language, src, tests, solution, build };
}

// ---- check ----

async function check(ex: Exercise): Promise<{ ok: boolean; line: string; detail?: string }> {
    for (const s of ex.solution) if (!ex.src.some((f) => f.path === s.path)) return { ok: false, line: `BAD ${ex.name}: solution file ${s.path} not in src/` };
    if (ex.solution.every((s) => s.content === ex.src.find((f) => f.path === s.path)!.content)) return { ok: false, line: `BAD ${ex.name}: the fix changes nothing` };
    const buggy = await run(ex, ex.src);
    const fixed = await run(ex, ex.src.map((f) => ex.solution.find((s) => s.path === f.path) ?? f));
    const count = (r: RunResult, s: string) => r.tests.filter((t) => t.status === s).length;
    const [bp, bf, fp, ff] = [count(buggy, "pass"), count(buggy, "fail"), count(fixed, "pass"), count(fixed, "fail")];
    const total = fp + ff;
    const lines = ex.src.reduce((n, f) => n + f.content.split("\n").length, 0);
    const problems = [
        bf === 0 && "no test fails on the buggy code",
        bp === 0 && "no test passes on the buggy code",
        (ff > 0 || fixed.exitCode !== 0 || fixed.timedOut || fixed.error) && "the reference fix doesn't pass every test",
        buggy.timedOut && "the buggy run timed out (make hangs fail fast)",
        ex.build && (total < minTests || total > maxTests) && `${total} tests (want ${minTests}-${maxTests})`,
        bp + bf !== total && "buggy and fixed runs report different tests (a test file doesn't compile on the buggy code?)",
    ].filter(Boolean);
    const line = `${problems.length ? "BAD" : "OK "} ${ex.name} [${ex.language}] buggy ${bp}/${bp + bf} fixed ${fp}/${total} · ${lines} src lines`;
    const failed = buggy.tests.filter((t) => t.status === "fail").map((t) => t.name).join("; ");
    return {
        ok: problems.length === 0,
        line: problems.length ? `${line}\n    ${problems.join("; ")}` : `${line}\n    fails on bug: ${failed}`,
        detail: problems.length ? `--- fixed run output:\n${fixed.error ?? ""}${fixed.output.slice(0, 3000)}\n--- buggy run output:\n${buggy.output.slice(0, 1500)}` : undefined,
    };
}

const root = (values.examples ?? values.gen)!;
const names = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name.includes(values.filter!))
    .map((e) => e.name)
    .sort();
const exercises: Exercise[] = [];
for (const name of names) {
    if (values.examples) {
        if (!existsSync(path.join(root, name, "public.json"))) continue;
        const ex = fromBank(root, name);
        if (ex) exercises.push(ex);
    } else if (existsSync(path.join(root, name, "meta.json"))) {
        exercises.push(fromGen(root, name));
    }
}

let next = 0;
let bad = 0;
const worker = async () => {
    while (next < exercises.length) {
        const ex = exercises[next++];
        const r = await check(ex).catch((err) => ({ ok: false, line: `BAD ${ex.name}: ${(err as Error).message}`, detail: undefined }));
        console.log(r.line);
        if (!r.ok) {
            bad++;
            if (r.detail) console.log(r.detail);
            continue;
        }
        if (values.write && ex.build) {
            const { pub, key } = ex.build();
            const dir = path.join(values.out!, ex.name);
            rmSync(dir, { recursive: true, force: true });
            for (const f of ex.src) {
                mkdirSync(path.dirname(path.join(dir, "src", f.path)), { recursive: true });
                writeFileSync(path.join(dir, "src", f.path), f.content);
            }
            writeFileSync(path.join(dir, "public.json"), JSON.stringify(pub, null, 2) + "\n");
            writeFileSync(path.join(dir, "key.json"), JSON.stringify(key, null, 2) + "\n");
        }
    }
};
await Promise.all(Array.from({ length: Math.max(1, Number(values.concurrency)) }, worker));
console.log(`${exercises.length - bad}/${exercises.length} OK${values.write ? ", written to " + values.out : ""}`);
process.exitCode = bad ? 1 : 0;
