// Server-only helpers that read example folders from disk.
// An example folder looks like:  <name>/public.json, <name>/key.json, <name>/src/**
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { exerciseKind, type ExampleKey, type ExamplePublic, type ExerciseKind, type SourceFile } from "../../shared/types";

// Where example folders live. Defaults to the repo root (one level above web/).
// turbopackIgnore: these are runtime paths, not files to bundle
export const EXAMPLES_ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.EXAMPLES_ROOT ?? path.join(process.cwd(), ".."));

export type LoadedExample = { name: string; public: ExamplePublic; key: ExampleKey; files: SourceFile[] };

// One row of the example list. `topic` is the example's target concept (the first of its concepts).
export type ExampleSummary = {
    name: string;        // folder, e.g. "examples/001-integrations-third_party_adapters"
    title: string;
    shortName: string;   // public.name, or the title for older examples without one
    topic: string;
    concepts: string[];
    questionCount: number;
    kind: ExerciseKind;  // "bugfix" (runnable fix question) or "comprehension"
    durationMinutes: number;
    language: string;
};

// Folders under EXAMPLES_ROOT/examples that contain a non-empty public.json.
// Cached per request (several pages and listJobMatches read it); folders are read in parallel.
export const listExamples = cache(async (): Promise<ExampleSummary[]> => {
    const names = (
        await Promise.all(
            ["examples"].map(async (base) => {
                const entries = await readdir(path.join(/*turbopackIgnore: true*/ EXAMPLES_ROOT, base), { withFileTypes: true }).catch(() => []);
                return entries
                    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
                    .map((e) => (base ? `${base}/${e.name}` : e.name));
            }),
        )
    ).flat();
    const found = await Promise.all(
        names.map(async (name): Promise<ExampleSummary | null> => {
            const pub = await readJson<ExamplePublic>(path.join(/*turbopackIgnore: true*/ EXAMPLES_ROOT, name, "public.json"));
            return pub && {
                name,
                title: pub.title,
                shortName: pub.name ?? pub.title,
                topic: pub.concepts?.[0] ?? "(none)",
                concepts: pub.concepts ?? [],
                questionCount: pub.questions?.length ?? 0,
                kind: exerciseKind(pub),
                durationMinutes: pub.durationMinutes ?? 0,
                language: pub.language,
            };
        }),
    );
    return found.filter((e) => e !== null).sort((a, b) => a.name.localeCompare(b.name));
});

export async function loadExample(name: string): Promise<LoadedExample | null> {
    const dir = resolveInside(EXAMPLES_ROOT, name);
    if (!dir) return null;
    const pub = await readJson<ExamplePublic>(path.join(dir, "public.json"));
    const key = await readJson<ExampleKey>(path.join(dir, "key.json"));
    if (!pub || !key) return null;
    const srcDir = path.join(dir, "src");
    const files = (await walk(srcDir)).map((abs) => ({ abs, rel: path.relative(srcDir, abs).split(path.sep).join("/") }));
    return {
        name,
        public: pub,
        key,
        files: await Promise.all(files.map(async ({ abs, rel }) => ({ path: rel, content: await readFile(abs, "utf8") }))),
    };
}

async function readJson<T>(file: string): Promise<T | null> {
    const raw = await readFile(file, "utf8").catch(() => "");
    if (raw.trim() === "") return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const out: string[] = [];
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(p)));
        else if (e.isFile() && (await stat(p)).size < 1_000_000) out.push(p);
    }
    return out.sort();
}

// Resolve `name` under `root`, refusing anything that escapes it (e.g. "../..").
function resolveInside(root: string, name: string): string | null {
    const abs = path.resolve(/*turbopackIgnore: true*/ root, name);
    return abs.startsWith(root + path.sep) ? abs : null;
}
