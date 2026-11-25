import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { codeFont } from "@/lib/fonts";
import type { RunResult } from "../../../../shared/types";

const ICON = { pass: Check, fail: X, skip: Minus } as const;
const COLOR = { pass: "text-emerald-400", fail: "text-red-400", skip: "text-muted-foreground" } as const;

// A fix question is correct when the run finished cleanly and no test failed.
export function allPassed(r: RunResult | null | undefined): boolean {
    return !!r && !r.error && !r.timedOut && r.exitCode === 0 && r.tests.length > 0 && r.tests.every((t) => t.status !== "fail");
}

// Test list (with failure messages) and the tests' console output.
export default function RunResultView({ result }: { result: RunResult }) {
    if (result.error) return <p className="text-xs text-red-400">{result.error}</p>;
    const passed = result.tests.filter((t) => t.status === "pass").length;
    const failed = result.tests.filter((t) => t.status === "fail").length;
    return (
        <div className="space-y-2 text-xs">
            <div className="font-medium">
                <span className="text-emerald-400">{passed} passed</span> · <span className="text-red-400">{failed} failed</span>
                {result.timedOut && <span className="text-red-400"> · timed out</span>}
            </div>
            <ul className="space-y-1">
                {result.tests.map((t, i) => {
                    const Icon = ICON[t.status];
                    return (
                        <li key={i}>
                            <div className="flex items-start gap-1.5">
                                <Icon className={cn("mt-0.5 size-3.5 shrink-0", COLOR[t.status])} />
                                <span>
                                    {t.name}
                                    {t.durationMs !== undefined && <span className="text-muted-foreground"> {t.durationMs.toFixed(0)}ms</span>}
                                </span>
                            </div>
                            {t.message && (
                                <pre className={cn("mt-1 ml-5 overflow-x-auto whitespace-pre-wrap text-[11px] text-red-400", codeFont.className)}>{t.message}</pre>
                            )}
                        </li>
                    );
                })}
                {result.tests.length === 0 && <li className="text-muted-foreground">No test results (see output).</li>}
            </ul>
            <div>
                <div className="text-muted-foreground">Output{result.exitCode !== null && ` (exit ${result.exitCode})`}</div>
                <pre className={cn("mt-1 max-h-48 overflow-auto rounded-md border bg-background p-2 text-[11px] whitespace-pre-wrap", codeFont.className)}>
                    {result.output || "(no output)"}
                </pre>
            </div>
        </div>
    );
}
