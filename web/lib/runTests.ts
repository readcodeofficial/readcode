// Server-only: run tests with Node's built-in test runner.
//
// LOCAL DEV ONLY. This executes the submitted code as a child process on the
// server with no sandbox. Before running untrusted code anywhere real, swap
// runTests() for a sandbox (Piston / Judge0 / E2B); the RunResult shape stays.
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RunResult, SourceFile } from "../../shared/types";

const TIMEOUT_MS = 20_000;
const MAX_OUTPUT = 64_000; // characters kept from the tests' stdout/stderr
const RESULTS_FILE = ".results.jsonl";

// node:test custom reporter: one JSON object per test, written to RESULTS_FILE.
// Tests run in the runner's own process (--test-isolation=none): one Node startup instead of two,
// and a timeout kill takes everything down. The tests' console output is then the process's
// own stdout/stderr, kept apart from the results because those go to a file.
const REPORTER = `
export default async function* reporter(source) {
  for await (const { type, data } of source) {
    if ((type === "test:pass" || type === "test:fail") && data.details?.type !== "suite") {
      const err = data.details?.error;
      const status = type === "test:fail" ? "fail" : data.skip || data.todo ? "skip" : "pass";
      yield JSON.stringify({
        kind: "test", name: data.name, status,
        durationMs: data.details?.duration_ms,
        message: err ? String(err.cause?.message ?? err.message) : undefined,
      }) + "\\n";
    }
  }
}
`;

// Write `files` into a temp folder and run the test files at `testPaths` (TypeScript runs natively on Node 23.6+).
export async function runTests(files: SourceFile[], testPaths: string[]): Promise<RunResult> {
    const dir = await mkdtemp(path.join(tmpdir(), "readcode-run-"));
    try {
        for (const f of files) {
            const target = path.resolve(dir, f.path);
            if (!target.startsWith(dir + path.sep)) throw new Error(`Unsafe path: ${f.path}`);
            await mkdir(path.dirname(target), { recursive: true });
            await writeFile(target, f.content);
        }
        await writeFile(path.join(dir, ".reporter.mjs"), REPORTER);

        // reporter is a module specifier: relative to cwd (an absolute Windows path would be read as a URL)
        const args = [
            "--test", "--test-isolation=none",
            "--test-reporter=./.reporter.mjs", `--test-reporter-destination=${RESULTS_FILE}`,
            ...testPaths,
        ];
        const { stdout, stderr, exitCode, timedOut } = await spawnNode(args, dir);

        // On a timeout the file holds the tests that finished before the kill.
        const results = await readFile(path.join(dir, RESULTS_FILE), "utf8").catch(() => "");
        const result: RunResult = { tests: [], output: (stdout + stderr).slice(0, MAX_OUTPUT), exitCode, timedOut };
        for (const line of results.split("\n")) {
            if (!line.startsWith("{")) continue;
            try {
                const e = JSON.parse(line);
                if (e.kind === "test") result.tests.push({ name: e.name, status: e.status, durationMs: e.durationMs, message: e.message });
            } catch {
                /* partial last line after a kill */
            }
        }
        return result;
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}

function spawnNode(args: string[], cwd: string) {
    return new Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }>((resolve, reject) => {
        // minimal env: don't hand the tests the server's secrets (API keys etc.)
        const env: NodeJS.ProcessEnv = {
            NODE_ENV: "test",
            PATH: process.env.PATH ?? "",
            ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
        };
        // process.execPath: the same Node that runs Next
        const child = spawn(process.execPath, args, { cwd, env });
        let stdout = "";
        let stderr = "";
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
        }, TIMEOUT_MS);
        child.stdout.on("data", (d) => (stdout += d));
        child.stderr.on("data", (d) => (stderr += d));
        child.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            resolve({ stdout, stderr, exitCode: code, timedOut });
        });
    });
}
