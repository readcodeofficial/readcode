"use server";

import { loadExample } from "@/lib/examples";
import { runTests } from "@/lib/runTests";
import type { RunResult } from "../../../../shared/types";

const empty = { tests: [], output: "", exitCode: null, timedOut: false };

// Run fix question `questionIndex` of an example against the candidate's edits.
// `edits` maps src/ path → edited content; only the question's editable files are taken from it,
// everything else (the rest of src/, the tests) comes from disk.
export async function runFixQuestion(
    exampleName: string,
    questionIndex: number,
    edits: Record<string, string>,
): Promise<RunResult> {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
        return { ...empty, error: "Running code is disabled outside local dev (no sandbox yet)." };
    }
    const example = await loadExample(exampleName);
    const question = example?.public.questions[questionIndex];
    if (!example || !question || question.kind !== "fix") return { ...empty, error: "Not a fix question." };

    const src = example.files.map((f) => ({
        path: `src/${f.path}`,
        content: question.editable.includes(f.path) && f.path in edits ? edits[f.path] : f.content,
    }));
    const tests = question.tests.map((t) => ({ path: `tests/${t.path}`, content: t.content }));
    try {
        return await runTests([...src, ...tests], tests.map((t) => t.path));
    } catch (err) {
        return { ...empty, error: err instanceof Error ? err.message : String(err) };
    }
}
