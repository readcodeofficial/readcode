"use client";

import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState, useTransition } from "react";
import type { LoadedExample } from "@/lib/examples";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, ChevronDown, FileCode, Pencil, Play, RotateCcw, TextSelect, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { codeFont } from "@/lib/fonts";
import type { DefectLocation, FixAnswer, LocateAnswer, RunResult, SourceFile } from "../../../../shared/types";
import { runFixQuestion } from "./actions";
import RunResultView, { allPassed } from "./RunResultView";

type MonacoEditor = Parameters<OnMount>[0];
type Decorations = ReturnType<MonacoEditor["createDecorationsCollection"]>;

// A candidate's answer to a locate question: marked lines, "no defect", or nothing yet.
type LocateMark = DefectLocation | "none" | null;

// A marked range counts as correct if it overlaps the defect, allowing this many lines either side.
const LINE_TOLERANCE = 1;

// Shown next to each question number. Legacy multiple-choice questions have no `kind`.
const QUESTION_LABEL = {
    fix: "Fix the bug · runnable",
    locate: "Find the defect",
    choice: "Multiple choice",
} as const;

// NOTE: the answer key is sent to the browser. Fine for a prototype, not for real use.
export default function ExampleViewer({ example }: { example: LoadedExample }) {
    const [current, setCurrent] = useState(example.files[0]?.path ?? "");
    const questions = example.public.questions;
    const [picked, setPicked] = useState<(number | null)[]>(questions.map(() => null));
    const [marks, setMarks] = useState<LocateMark[]>(questions.map(() => null));
    const [submitted, setSubmitted] = useState<boolean[]>(questions.map(() => false));
    // fix questions: edited src/ files (path → content), and each question's latest test run
    const [edits, setEdits] = useState<Record<string, string>>({});
    const [runs, setRuns] = useState<(RunResult | null)[]>(questions.map(() => null));
    const [running, startRun] = useTransition();

    const editorRef = useRef<MonacoEditor | null>(null);
    const decorationsRef = useRef<Decorations | null>(null);
    const [editorReady, setEditorReady] = useState(false);

    // Files in the tree: src/ as stored, plus each fix question's tests under tests/ (read-only).
    const testFiles: SourceFile[] = questions.flatMap((q) =>
        q.kind === "fix" ? q.tests.map((t) => ({ path: `tests/${t.path}`, content: t.content })) : [],
    );
    const allFiles = [...example.files, ...testFiles];
    // A src/ file is editable while some unsubmitted fix question lists it.
    const editable = new Set(questions.flatMap((q, qi) => (q.kind === "fix" && !submitted[qi] ? q.editable : [])));
    const editableEver = new Set(questions.flatMap((q) => (q.kind === "fix" ? q.editable : [])));

    const file = allFiles.find((f) => f.path === current);
    const contentOf = (p: string) => edits[p] ?? allFiles.find((f) => f.path === p)?.content ?? "";
    const isCorrect = (qi: number) => {
        const q = questions[qi];
        const answer = example.key.answers[qi];
        if (q.kind === "fix") return allPassed(runs[qi]);
        if (q.kind === "locate") return locateCorrect(marks[qi], answer as LocateAnswer);
        return picked[qi] === answer;
    };
    const doneCount = submitted.filter(Boolean).length;
    const score = questions.filter((_, qi) => submitted[qi] && isCorrect(qi)).length;

    // Run qi's tests against the current edits; with `submit`, lock the question afterwards.
    const runFix = (qi: number, submit: boolean) =>
        startRun(async () => {
            const result = await runFixQuestion(example.name, qi, edits);
            setRuns((r) => r.map((v, i) => (i === qi ? result : v)));
            if (submit) setSubmitted((s) => s.map((v, i) => (i === qi ? true : v)));
        });

    // Highlight, in the open file: the candidate's marked lines, and after submission the actual defect.
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || !editorReady) return;
        const ranges: { range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }; options: { isWholeLine: boolean; className: string } }[] = [];
        questions.forEach((q, qi) => {
            if (q.kind !== "locate") return;
            const mark = marks[qi];
            if (mark && mark !== "none" && mark.path === current) {
                ranges.push(lineRange(mark, "rc-marked"));
            }
            const answer = example.key.answers[qi] as LocateAnswer;
            if (submitted[qi] && answer.defect && answer.defect.path === current) {
                ranges.push(lineRange(answer.defect, "rc-defect"));
            }
        });
        if (!decorationsRef.current) decorationsRef.current = editor.createDecorationsCollection(ranges);
        else decorationsRef.current.set(ranges);
    }, [current, marks, submitted, editorReady, questions, example.key.answers]);

    const onMount: OnMount = (editor) => {
        editorRef.current = editor;
        setEditorReady(true);
    };

    // Mark the lines currently selected in the editor (or the cursor's line) for question qi.
    const markSelection = (qi: number) => {
        const sel = editorRef.current?.getSelection();
        if (!sel) return;
        let endLine = sel.endLineNumber;
        if (sel.endColumn === 1 && endLine > sel.startLineNumber) endLine--; // selection ending at a line start
        const mark: DefectLocation = { path: current, startLine: sel.startLineNumber, endLine };
        setMarks((m) => m.map((v, i) => (i === qi ? mark : v)));
    };

    const jumpTo = (loc: DefectLocation) => {
        setCurrent(loc.path);
        // after the editor switches files, scroll to the range
        setTimeout(() => editorRef.current?.revealLinesInCenter(loc.startLine, loc.endLine), 0);
    };

    const canSubmit = (qi: number) => {
        const kind = questions[qi].kind;
        if (kind === "fix") return !running;
        return kind === "locate" ? marks[qi] !== null : picked[qi] !== null;
    };

    const reset = () => {
        setPicked(questions.map(() => null));
        setMarks(questions.map(() => null));
        setSubmitted(questions.map(() => false));
        setEdits({});
        setRuns(questions.map(() => null));
    };
    const submit = (qi: number) =>
        questions[qi].kind === "fix" ? runFix(qi, true) : setSubmitted((s) => s.map((v, i) => (i === qi ? true : v)));

    return (
        <div className="flex min-h-0 flex-1">
            {/* files */}
            <nav className={cn("w-56 shrink-0 overflow-auto border-r py-3 text-[13px]", codeFont.className)} aria-label="Files">
                <div className="mb-2 px-3 font-sans text-xs font-medium text-muted-foreground">Files</div>
                <FileTree
                    node={buildTree(allFiles.map((f) => f.path))}
                    current={current}
                    onOpen={setCurrent}
                    depth={0}
                    badge={(p) => (editableEver.has(p) ? (p in edits ? "✎*" : "✎") : "")}
                />
                {editableEver.size > 0 && (
                    <div className="mt-3 px-3 font-sans text-xs text-muted-foreground">✎ editable · * changed</div>
                )}
            </nav>

            {/* code */}
            <section className="flex min-w-0 flex-1 flex-col">
                {editable.has(current) && (
                    <div className="flex items-center gap-3 border-b px-3 py-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                            <Pencil className="size-3" /> editing {current}
                        </span>
                        {current in edits && (
                            <button
                                className="underline underline-offset-2 hover:text-foreground"
                                onClick={() => setEdits((e) => Object.fromEntries(Object.entries(e).filter(([p]) => p !== current)))}
                            >
                                undo my changes to this file
                            </button>
                        )}
                    </div>
                )}
                <div className="min-h-0 flex-1">
                    <Editor
                        path={current}
                        value={file ? contentOf(current) : ""}
                        onChange={(v) => editable.has(current) && setEdits((e) => ({ ...e, [current]: v ?? "" }))}
                        language={languageFor(current)}
                        theme="readcode-dark"
                        beforeMount={defineTheme}
                        onMount={onMount}
                        options={{
                            readOnly: !editable.has(current),
                            minimap: { enabled: false },
                            fontSize: 13,
                            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                            scrollBeyondLastLine: false,
                            renderLineHighlight: "none",
                            padding: { top: 12 },
                        }}
                    />
                </div>
            </section>

            {/* questions */}
            <aside className="flex w-[28rem] shrink-0 flex-col border-l">
                {/* progress */}
                <div className="border-b px-4 py-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                            {doneCount} of {questions.length} answered{doneCount > 0 && <> · <span className="text-foreground">{score} correct</span></>}
                        </span>
                        {doneCount > 0 && (
                            <Button variant="ghost" size="xs" onClick={reset} className="text-muted-foreground">
                                <RotateCcw /> Reset
                            </Button>
                        )}
                    </div>
                    <div className="mt-2 flex gap-1">
                        {questions.map((_, qi) => (
                            <span
                                key={qi}
                                className={cn(
                                    "h-1 flex-1 rounded-full",
                                    !submitted[qi] ? "bg-muted" : isCorrect(qi) ? "bg-emerald-500" : "bg-red-500",
                                )}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex-1 space-y-3 overflow-auto p-4">
                    {questions.map((q, qi) => {
                        const done = submitted[qi];
                        const answer = example.key.answers[qi];
                        const explanation = example.key.explanations?.[qi];
                        const correct = done && isCorrect(qi);
                        const run = runs[qi];
                        return (
                            <Card
                                key={qi}
                                data-question={qi + 1}
                                className={cn("gap-3 px-4 py-4", done && (correct ? "ring-emerald-500/40" : "ring-red-500/40"))}
                            >
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span data-slot="question-label">
                                        <span className="font-medium text-foreground">Q{qi + 1}</span> · {QUESTION_LABEL[q.kind ?? "choice"]}
                                    </span>
                                    {done && (
                                        <span className={cn("flex items-center gap-1 font-medium", correct ? "text-emerald-400" : "text-red-400")}>
                                            {correct ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                                            {correct ? "Correct" : "Incorrect"}
                                            {q.kind === "fix" && <span className="font-normal">{correct ? " (all tests pass)" : " (some tests fail)"}</span>}
                                        </span>
                                    )}
                                </div>
                                <p className="leading-relaxed whitespace-pre-wrap">{q.prompt}</p>

                                {q.kind === "fix" ? (
                                    <div className="space-y-2">
                                        <div className={cn("space-y-1 text-xs text-muted-foreground", codeFont.className)}>
                                            <p>
                                                <span className="font-sans">Edit: </span>
                                                {q.editable.map((p) => (
                                                    <button key={p} className="mr-2 text-foreground underline underline-offset-2" onClick={() => setCurrent(p)}>
                                                        {p}
                                                    </button>
                                                ))}
                                            </p>
                                            <p>
                                                <span className="font-sans">Tests: </span>
                                                {q.tests.map((t) => (
                                                    <button key={t.path} className="mr-2 underline underline-offset-2 hover:text-foreground" onClick={() => setCurrent(`tests/${t.path}`)}>
                                                        tests/{t.path}
                                                    </button>
                                                ))}
                                            </p>
                                        </div>
                                        {!done && (
                                            <Button size="sm" variant="secondary" disabled={running} onClick={() => runFix(qi, false)}>
                                                <Play /> {running ? "Running…" : "Run tests"}
                                            </Button>
                                        )}
                                        {run && <RunResultView result={run} />}
                                    </div>
                                ) : q.kind === "locate" ? (
                                    <div className="space-y-2">
                                        {!done && (
                                            <div className="flex flex-wrap gap-2">
                                                <Button size="sm" variant="secondary" onClick={() => markSelection(qi)}>
                                                    <TextSelect /> Mark selected lines
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => setMarks((m) => m.map((v, i) => (i === qi ? "none" : v)))}>
                                                    No defect
                                                </Button>
                                            </div>
                                        )}
                                        <p className="text-xs text-muted-foreground">
                                            {marks[qi] === null && "Select line(s) in the editor, then mark them."}
                                            {marks[qi] === "none" && "Your answer: no defect"}
                                            {marks[qi] && marks[qi] !== "none" && (
                                                <>
                                                    Your answer:{" "}
                                                    <button className="text-foreground underline underline-offset-2" onClick={() => jumpTo(marks[qi] as DefectLocation)}>
                                                        {describe(marks[qi] as DefectLocation)}
                                                    </button>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5" role="radiogroup">
                                        {q.choices.map((c, ci) => {
                                            const selected = picked[qi] === ci;
                                            const isAnswer = done && ci === answer;
                                            const isWrongPick = done && selected && ci !== answer;
                                            return (
                                                <button
                                                    key={ci}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={selected}
                                                    disabled={done}
                                                    onClick={() => setPicked((p) => p.map((v, i) => (i === qi ? ci : v)))}
                                                    className={cn(
                                                        "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                                                        !done && (selected ? "border-foreground/60 bg-muted" : "hover:border-foreground/30 hover:bg-muted/40"),
                                                        isAnswer && "border-emerald-500/60 bg-emerald-500/10",
                                                        isWrongPick && "border-red-500/60 bg-red-500/10",
                                                        done && !isAnswer && !isWrongPick && "opacity-60",
                                                    )}
                                                >
                                                    <span
                                                        className={cn(
                                                            "mt-px flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-medium",
                                                            selected && !done && "border-foreground bg-foreground text-background",
                                                        )}
                                                    >
                                                        {String.fromCharCode(65 + ci)}
                                                    </span>
                                                    <span className="leading-snug">{c}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {!done ? (
                                    <Button size="sm" className="w-fit" disabled={!canSubmit(qi)} onClick={() => submit(qi)}>
                                        {q.kind === "fix" ? "Submit (runs the tests)" : "Submit"}
                                    </Button>
                                ) : (
                                    <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-[13px] leading-relaxed">
                                        {q.kind === "fix" ? (
                                            <details>
                                                <summary className="cursor-pointer font-medium">Show reference fix</summary>
                                                {(answer as FixAnswer).solution.map((f) => (
                                                    <div key={f.path} className="mt-2">
                                                        <div className={cn("text-xs text-muted-foreground", codeFont.className)}>{f.path}</div>
                                                        <pre className={cn("mt-1 max-h-64 overflow-auto rounded-md border bg-background p-2 text-xs", codeFont.className)}>
                                                            {f.content}
                                                        </pre>
                                                    </div>
                                                ))}
                                            </details>
                                        ) : q.kind === "locate" ? (
                                            (answer as LocateAnswer).defect ? (
                                                <p className="font-medium">
                                                    The defect is at{" "}
                                                    <button className="underline underline-offset-2" onClick={() => jumpTo((answer as LocateAnswer).defect!)}>
                                                        {describe((answer as LocateAnswer).defect!)}
                                                    </button>
                                                    .
                                                </p>
                                            ) : (
                                                <p className="font-medium">There is no defect in this code.</p>
                                            )
                                        ) : (
                                            !correct && <p className="font-medium">The answer is {String.fromCharCode(65 + (answer as number))}.</p>
                                        )}
                                        {explanation && <p className="whitespace-pre-wrap text-muted-foreground">{explanation}</p>}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </aside>
        </div>
    );
}

// Editor theme matching the page: the app's dark background, no line-highlight box.
const defineTheme: BeforeMount = (monaco) => {
    monaco.editor.defineTheme("readcode-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
            "editor.background": "#0a0a0a",
            "editorGutter.background": "#0a0a0a",
            "editorLineNumber.foreground": "#525252",
            "editorLineNumber.activeForeground": "#a3a3a3",
        },
    });
};

function locateCorrect(mark: LocateMark, answer: LocateAnswer): boolean {
    if (mark === null) return false;
    if (answer.defect === null) return mark === "none";
    if (mark === "none" || mark.path !== answer.defect.path) return false;
    return mark.startLine <= answer.defect.endLine + LINE_TOLERANCE && mark.endLine >= answer.defect.startLine - LINE_TOLERANCE;
}

function describe(loc: DefectLocation): string {
    return loc.startLine === loc.endLine ? `${loc.path} line ${loc.startLine}` : `${loc.path} lines ${loc.startLine}–${loc.endLine}`;
}

function lineRange(loc: DefectLocation, className: string) {
    return {
        range: { startLineNumber: loc.startLine, startColumn: 1, endLineNumber: loc.endLine, endColumn: 1 },
        options: { isWholeLine: true, className },
    };
}

// ---- file tree ----

type TreeNode = { name: string; path: string; children: TreeNode[]; isFile: boolean };

// Turn flat paths ("a/b/c.ts") into a folder tree. Folders first, then files, alphabetical.
function buildTree(paths: string[]): TreeNode {
    const root: TreeNode = { name: "", path: "", children: [], isFile: false };
    for (const p of paths) {
        let node = root;
        p.split("/").forEach((part, i, parts) => {
            const isFile = i === parts.length - 1;
            let child = node.children.find((c) => c.name === part && c.isFile === isFile);
            if (!child) {
                child = { name: part, path: parts.slice(0, i + 1).join("/"), children: [], isFile };
                node.children.push(child);
            }
            node = child;
        });
    }
    const sort = (n: TreeNode) => {
        n.children.sort((a, b) => Number(a.isFile) - Number(b.isFile) || a.name.localeCompare(b.name));
        n.children.forEach(sort);
    };
    sort(root);
    return root;
}

type TreeProps = { node: TreeNode; current: string; onOpen: (path: string) => void; depth: number; badge?: (path: string) => string };

function FileTree({ node, current, onOpen, depth, badge }: TreeProps) {
    return (
        <ul>
            {node.children.map((child) =>
                child.isFile ? (
                    <li key={child.path}>
                        <button
                            onClick={() => onOpen(child.path)}
                            title={child.path}
                            style={{ paddingLeft: depth * 12 + 12 }}
                            className={cn(
                                "flex w-full items-center gap-1.5 truncate py-1 pr-2 text-left",
                                child.path === current ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                            )}
                        >
                            <FileCode className="size-3.5 shrink-0" />
                            <span className="truncate">{child.name}</span>
                            {badge?.(child.path) && <span className="ml-auto text-xs text-amber-400">{badge(child.path)}</span>}
                        </button>
                    </li>
                ) : (
                    <Folder key={child.path} node={child} current={current} onOpen={onOpen} depth={depth} badge={badge} />
                ),
            )}
        </ul>
    );
}

function Folder({ node, current, onOpen, depth, badge }: TreeProps) {
    const [open, setOpen] = useState(true);
    return (
        <li>
            <button
                onClick={() => setOpen((o) => !o)}
                style={{ paddingLeft: depth * 12 + 8 }}
                className="flex w-full items-center gap-1 truncate py-1 pr-2 text-left text-muted-foreground hover:text-foreground"
            >
                <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
                {node.name}
            </button>
            {open && <FileTree node={node} current={current} onOpen={onOpen} depth={depth + 1} badge={badge} />}
        </li>
    );
}

function languageFor(p: string): string {
    const ext = p.split(".").pop() ?? "";
    const map: Record<string, string> = {
        ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", py: "python", go: "go",
        java: "java", rs: "rust", rb: "ruby", cs: "csharp", kt: "kotlin", json: "json", sql: "sql",
        yml: "yaml", yaml: "yaml", md: "markdown", sh: "shell",
    };
    return map[ext] ?? "plaintext";
}
