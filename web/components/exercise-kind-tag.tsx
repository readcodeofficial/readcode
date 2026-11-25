import { BookOpen, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExerciseKind } from "../../shared/types";

const TAG: Record<ExerciseKind, { label: string; Icon: typeof Wrench; className: string }> = {
    bugfix: { label: "Bug fix", Icon: Wrench, className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    comprehension: { label: "Comprehension", Icon: BookOpen, className: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400" },
};

// Pill showing an exercise's type: a runnable bug fix, or comprehension (reading questions).
export function ExerciseKindTag({ kind, className }: { kind: ExerciseKind; className?: string }) {
    const { label, Icon, className: color } = TAG[kind];
    return (
        <span
            data-exercise-kind={kind}
            className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-medium whitespace-nowrap", color, className)}
        >
            <Icon className="size-3" />
            {label}
        </span>
    );
}

export const questionsLabel = (n: number) => `${n} question${n === 1 ? "" : "s"}`;
