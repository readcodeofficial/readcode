// Run a fix question's tests against a set of files, in the exercise's language. Server/CLI only (spawns processes).
//
// LOCAL DEV ONLY: this executes submitted code as a child process with no sandbox. Before running untrusted
// code anywhere real, swap runTests() for a sandbox (Piston / Judge0 / E2B); the RunResult shape stays.
//
// Every language uses only its standard toolchain, nothing to install:
//   TypeScript/JavaScript  node --test (Node >= 23.6 runs .ts natively); tests in tests/*.test.ts|js
//   Python                 unittest discovery in tests/ (test_*.py), with src/ on sys.path
//   Go                     go test -json ./tests/... in a throwaway module "exercise"; tests import exercise/src/<pkg>
//   Java                   javac + a tiny harness: test classes in tests/ (public no-arg constructor, public void test*()
//                          methods, optional setUp()), assertions from readcode.Assert
// Each runner writes one JSON line per test to RESULTS_FILE and exits 0 only if every test passed.
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RunResult, SourceFile } from "./types.ts";

export const RUNNABLE_LANGUAGES = ["TypeScript", "JavaScript", "Python", "Go", "Java"] as const;
const TIMEOUT_MS: Record<string, number> = { TypeScript: 20_000, JavaScript: 20_000, Python: 20_000, Go: 90_000, Java: 45_000 };
const MAX_OUTPUT = 64_000; // characters kept from the tests' stdout/stderr
const RESULTS_FILE = ".results.jsonl";

type Command = { cmd: string; args: string[] }[];

// Write `files` (paths like src/... and tests/...) into a temp folder and run the tests at `testPaths`.
export async function runTests(language: string, files: SourceFile[], testPaths: string[]): Promise<RunResult> {
    const setup = SETUP[language];
    if (!setup) return { tests: [], output: "", exitCode: null, timedOut: false, error: `Running ${language} tests isn't supported yet.` };

    const dir = await mkdtemp(path.join(tmpdir(), "readcode-run-"));
    try {
        for (const f of files) await put(dir, f.path, f.content);
        const commands = await setup(dir, files, testPaths);
        let stdout = "";
        let exitCode: number | null = 0;
        let timedOut = false;
        const deadline = Date.now() + (TIMEOUT_MS[language] ?? 20_000);
        for (const { cmd, args } of commands) {
            const r = await spawnIn(cmd, args, dir, Math.max(1, deadline - Date.now()));
            stdout += r.output;
            exitCode = r.exitCode;
            timedOut = r.timedOut;
            if (exitCode !== 0 || timedOut) break; // e.g. a compile error: no point running the tests
        }

        // On a timeout or crash the file holds the tests that finished before it.
        const lines = await readFile(path.join(dir, RESULTS_FILE), "utf8").catch(() => "");
        const result: RunResult = { tests: [], output: stdout.slice(0, MAX_OUTPUT), exitCode, timedOut };
        for (const line of lines.split("\n")) {
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
        // Windows can hold files briefly after a kill; cleanup must never turn a result into an error
        await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
    }
}

async function put(dir: string, rel: string, content: string) {
    const target = path.resolve(dir, rel);
    if (!target.startsWith(dir + path.sep)) throw new Error(`Unsafe path: ${rel}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
}

// ---- per-language setup: write any harness files, return the commands to run in order ----

const SETUP: Record<string, (dir: string, files: SourceFile[], testPaths: string[]) => Promise<Command>> = {
    TypeScript: nodeSetup,
    JavaScript: nodeSetup,

    async Python(dir) {
        await put(dir, ".readcode_runner.py", PY_RUNNER);
        return [{ cmd: "python", args: ["-X", "utf8", "-B", ".readcode_runner.py"] }];
    },

    async Go(dir) {
        await put(dir, "go.mod", "module exercise\n\ngo 1.23\n"); // 1.22+: each loop iteration gets its own variable
        await put(dir, ".readcode_gotest.js", GO_REPORTER);
        // go test -json streams events; a small Node filter turns them into RESULTS_FILE lines
        return [{ cmd: process.execPath, args: [".readcode_gotest.js"] }];
    },

    async Java(dir, files) {
        await put(dir, ".readcode/readcode/Assert.java", JAVA_ASSERT);
        await put(dir, ".readcode/readcode/TestMain.java", JAVA_MAIN);
        const sources = [
            ...files.filter((f) => f.path.endsWith(".java")).map((f) => f.path),
            ".readcode/readcode/Assert.java",
            ".readcode/readcode/TestMain.java",
        ];
        const testClasses = files
            .filter((f) => f.path.startsWith("tests/") && f.path.endsWith(".java"))
            .map((f) => {
                const pkg = f.content.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1];
                const cls = path.basename(f.path, ".java");
                return pkg ? `${pkg}.${cls}` : cls;
            });
        return [
            { cmd: "javac", args: ["-encoding", "UTF-8", "-nowarn", "-d", ".out", ...sources] },
            { cmd: "java", args: ["-cp", ".out", "readcode.TestMain", ...testClasses] },
        ];
    },
};

async function nodeSetup(dir: string, _files: SourceFile[], testPaths: string[]): Promise<Command> {
    await put(dir, ".reporter.mjs", NODE_REPORTER);
    // reporter is a module specifier: relative to cwd (an absolute Windows path would be read as a URL)
    return [
        {
            cmd: process.execPath,
            args: ["--test", "--test-isolation=none", "--test-reporter=./.reporter.mjs", `--test-reporter-destination=${RESULTS_FILE}`, ...testPaths],
        },
    ];
}

function spawnIn(cmd: string, args: string[], cwd: string, timeoutMs: number) {
    return new Promise<{ output: string; exitCode: number | null; timedOut: boolean }>((resolve) => {
        // minimal env: don't hand the tests the server's secrets (API keys etc.)
        const keep = ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "JAVA_HOME", "LOCALAPPDATA", "USERPROFILE", "HOME", "GOROOT"];
        const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
        for (const k of keep) if (process.env[k]) env[k] = process.env[k];
        Object.assign(env, {
            PYTHONDONTWRITEBYTECODE: "1",
            PYTHONUTF8: "1",
            GOCACHE: path.join(tmpdir(), "readcode-gocache"), // shared build cache: later Go runs are fast
            GOPATH: path.join(tmpdir(), "readcode-gopath"),
            GOTOOLCHAIN: "local",
            GOPROXY: "off",
            GOFLAGS: "-mod=mod",
            CGO_ENABLED: "0",
        });
        let output = "";
        let timedOut = false;
        // Own process group on Unix, so a timeout can kill grandchildren too (go test runs a test binary)
        const child = spawn(cmd, args, { cwd, env, detached: process.platform !== "win32" });
        const timer = setTimeout(() => {
            timedOut = true;
            killTree(child.pid);
        }, timeoutMs);
        child.stdout.on("data", (d) => (output += d));
        child.stderr.on("data", (d) => (output += d));
        child.on("error", (err) => {
            clearTimeout(timer);
            resolve({ output: output + `\n${cmd}: ${err.message}\n`, exitCode: null, timedOut });
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            resolve({ output, exitCode: code, timedOut });
        });
    });
}

// Kill a process and everything it started (a plain kill leaves e.g. go's test binary running).
function killTree(pid: number | undefined) {
    if (pid === undefined) return;
    try {
        if (process.platform === "win32") spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
        else process.kill(-pid, "SIGKILL");
    } catch {
        /* already gone */
    }
}

// ---- harness sources ----

// node:test custom reporter: one JSON object per test (suites skipped).
const NODE_REPORTER = `
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

const PY_RUNNER = `
import json, os, sys, time, traceback, unittest
sys.path.insert(0, os.path.abspath("src"))
results = []

class Result(unittest.TestResult):
    def startTest(self, test):
        self._t0 = time.perf_counter()
        super().startTest(test)
    def _record(self, test, status, err=None):
        name = getattr(test, "_testMethodName", str(test))
        if name.startswith("test_"):
            name = name[5:]
        message = None
        if err is not None:
            message = "".join(traceback.format_exception_only(err[0], err[1])).strip()
        results.append({"kind": "test", "name": name.replace("_", " "), "status": status,
                        "durationMs": round((time.perf_counter() - getattr(self, "_t0", time.perf_counter())) * 1000, 1),
                        "message": message})
    def addSuccess(self, test): super().addSuccess(test); self._record(test, "pass")
    def addFailure(self, test, err): super().addFailure(test, err); self._record(test, "fail", err)
    def addError(self, test, err):
        super().addError(test, err)
        if not hasattr(test, "_testMethodName"):  # module failed to import: report it as one failed test
            print("".join(traceback.format_exception(*err)), file=sys.stderr)
        self._record(test, "fail", err)
    def addSkip(self, test, reason): super().addSkip(test, reason); self._record(test, "skip")

suite = unittest.defaultTestLoader.discover("tests", pattern="test*.py", top_level_dir="tests")
result = Result()
suite.run(result)
with open(".results.jsonl", "w", encoding="utf-8") as f:
    for r in results:
        f.write(json.dumps(r) + "\\n")
ok = results and all(r["status"] != "fail" for r in results)
sys.exit(0 if ok else 1)
`;

// Runs go test -json and converts its event stream; build failures surface as output with a non-zero exit.
const GO_REPORTER = `
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const out = fs.createWriteStream(".results.jsonl");
const logs = new Map();
const child = spawn("go", ["test", "-json", "-count=1", "./tests/..."], { env: process.env });
let buf = "";
child.stdout.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\\n")) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    let e; try { e = JSON.parse(line); } catch { process.stdout.write(line + "\\n"); continue; }
    if (e.Action === "output") {
      if (e.Test) logs.set(e.Test, (logs.get(e.Test) || "") + e.Output);
      if (!/^(=== RUN|--- (PASS|FAIL|SKIP)|PASS$|FAIL$|ok |FAIL\\t)/.test(e.Output.trim())) process.stdout.write(e.Output);
      continue;
    }
    if (e.Test && !e.Test.includes("/") && ["pass", "fail", "skip"].includes(e.Action)) {
      const log = (logs.get(e.Test) || "").split("\\n").filter((l) => l && !/^\\s*(=== RUN|--- (PASS|FAIL|SKIP))/.test(l)).join("\\n").trim();
      out.write(JSON.stringify({ kind: "test", name: e.Test.replace(/^Test/, "").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase(),
        status: e.Action, durationMs: Math.round((e.Elapsed || 0) * 1000), message: e.Action === "fail" ? log || undefined : undefined }) + "\\n");
    }
  }
});
child.stderr.on("data", (d) => process.stderr.write(d));
child.on("close", (code) => out.end(() => process.exit(code ?? 1)));
`;

const JAVA_ASSERT = `
package readcode;

import java.util.Objects;

/** Assertions for exercise tests (no JUnit available offline). */
public final class Assert {
    private Assert() {}

    @FunctionalInterface
    public interface Block { void run() throws Throwable; }

    public static void fail(String message) { throw new AssertionError(message); }
    public static void assertTrue(boolean c) { assertTrue(c, "expected true"); }
    public static void assertTrue(boolean c, String message) { if (!c) fail(message); }
    public static void assertFalse(boolean c) { assertFalse(c, "expected false"); }
    public static void assertFalse(boolean c, String message) { if (c) fail(message); }
    public static void assertNull(Object o) { if (o != null) fail("expected null but was <" + o + ">"); }
    public static void assertNotNull(Object o) { if (o == null) fail("expected a value but was null"); }
    public static void assertEquals(Object expected, Object actual) { assertEquals(expected, actual, null); }
    public static void assertEquals(Object expected, Object actual, String message) {
        if (!Objects.equals(expected, actual))
            fail((message == null ? "" : message + ": ") + "expected <" + expected + "> but was <" + actual + ">");
    }
    public static void assertEquals(long expected, long actual) { assertEquals(Long.valueOf(expected), Long.valueOf(actual), null); }
    public static void assertEquals(long expected, long actual, String message) { assertEquals(Long.valueOf(expected), Long.valueOf(actual), message); }
    public static void assertEquals(double expected, double actual, double delta) {
        if (Math.abs(expected - actual) > delta) fail("expected <" + expected + "> but was <" + actual + ">");
    }
    public static <T extends Throwable> T assertThrows(Class<T> type, Block block) {
        try {
            block.run();
        } catch (Throwable t) {
            if (type.isInstance(t)) return type.cast(t);
            fail("expected " + type.getSimpleName() + " but got " + t);
        }
        throw new AssertionError("expected " + type.getSimpleName() + " to be thrown");
    }
}
`;

const JAVA_MAIN = `
package readcode;

import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;

/** Runs public void test*() methods of the given classes, one fresh instance per test; setUp() runs first if present. */
public final class TestMain {
    public static void main(String[] args) throws Exception {
        boolean allPassed = true;
        int count = 0;
        try (Writer out = new OutputStreamWriter(new FileOutputStream(".results.jsonl"), StandardCharsets.UTF_8)) {
            for (String className : args) {
                Class<?> cls = Class.forName(className);
                Method[] tests = Arrays.stream(cls.getMethods())
                        .filter(m -> m.getName().startsWith("test") && m.getParameterCount() == 0
                                && m.getReturnType() == void.class && !Modifier.isStatic(m.getModifiers()))
                        .sorted(Comparator.comparing(Method::getName))
                        .toArray(Method[]::new);
                for (Method m : tests) {
                    count++;
                    long t0 = System.nanoTime();
                    String status = "pass";
                    String message = null;
                    try {
                        Object instance = cls.getDeclaredConstructor().newInstance();
                        try {
                            Method setUp = cls.getMethod("setUp");
                            setUp.invoke(instance);
                        } catch (NoSuchMethodException ignored) {
                        }
                        m.invoke(instance);
                    } catch (InvocationTargetException e) {
                        status = "fail";
                        Throwable cause = e.getCause();
                        message = cause instanceof AssertionError ? cause.getMessage() : cause.toString();
                    } catch (Throwable e) {
                        status = "fail";
                        message = e.toString();
                    }
                    if (status.equals("fail")) allPassed = false;
                    double ms = (System.nanoTime() - t0) / 1e6;
                    out.write("{\\"kind\\":\\"test\\",\\"name\\":" + json(prettify(m.getName())) + ",\\"status\\":\\"" + status
                            + "\\",\\"durationMs\\":" + Math.round(ms * 10) / 10.0
                            + (message == null ? "" : ",\\"message\\":" + json(message)) + "}\\n");
                    out.flush();
                }
            }
        }
        System.exit(allPassed && count > 0 ? 0 : 1);
    }

    private static String prettify(String name) {
        String s = name.startsWith("test") ? name.substring(4) : name;
        return s.replaceAll("_", " ").replaceAll("([a-z0-9])([A-Z])", "$1 $2").toLowerCase().trim();
    }

    private static String json(String s) {
        StringBuilder b = new StringBuilder("\\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> b.append("\\\\\\"");
                case '\\\\' -> b.append("\\\\\\\\");
                case '\\n' -> b.append("\\\\n");
                case '\\r' -> b.append("\\\\r");
                case '\\t' -> b.append("\\\\t");
                default -> { if (c < 0x20) b.append(String.format("\\\\u%04x", (int) c)); else b.append(c); }
            }
        }
        return b.append('"').toString();
    }
}
`;
