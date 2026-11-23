import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Check, Circle, CircleDashed } from "lucide-react";
import { startBreadthPlan } from "@/app/actions";
import { currentUser } from "@/lib/auth";
import { getDashboard, type Dashboard, type TopicProgress } from "@/lib/progress";
import { areaOf, areaTitle, pct, topicName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const exampleHref = (name: string) => `/examples/${encodeURIComponent(name)}`;

export default function MePage() {
    return (
        <main className="mx-auto w-full max-w-5xl px-6 py-10">
            <h1 className="text-4xl font-semibold tracking-tight">My progress</h1>
            <Suspense fallback={<DashboardSkeleton />}>
                <DashboardContent />
            </Suspense>
        </main>
    );
}

async function DashboardContent() {
    const user = await currentUser();
    if (!user) redirect("/sign-in?next=/me");
    const d = await getDashboard(user.id);
    return (
        <>
            <p className="mt-3 mb-8 text-muted-foreground">Signed in as {user.email}</p>
            <Stats stats={d.stats} />
            <PlanSection plan={d.plan} />
            <div className="mt-10 grid gap-8 md:grid-cols-2">
                <Saved saved={d.saved} />
                <Recent recent={d.recent} />
            </div>
        </>
    );
}

function Stats({ stats }: { stats: Dashboard["stats"] }) {
    const items = [
        { label: "Exercises completed", value: String(stats.completed) },
        { label: "Questions answered", value: String(stats.questionsAnswered) },
        { label: "Accuracy", value: stats.questionsAnswered ? pct(stats.correct / stats.questionsAnswered) : "–" },
    ];
    return (
        <div className="grid grid-cols-3 gap-3">
            {items.map((s) => (
                <Card key={s.label} className="gap-1 px-4 py-4">
                    <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                </Card>
            ))}
        </div>
    );
}

function PlanSection({ plan }: { plan: Dashboard["plan"] }) {
    if (!plan) {
        return (
            <Card className="mt-10 gap-3 px-6 py-6">
                <h2 className="text-lg font-semibold">Cover the whole field</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">
                    A breadth plan lists every backend and systems topic in the taxonomy. Complete one exercise in each, and this page tracks
                    which areas you&apos;ve covered and which are still gaps.
                </p>
                <form action={startBreadthPlan}>
                    <Button type="submit">Start a full-field plan</Button>
                </form>
            </Card>
        );
    }

    const covered = plan.topics.filter((t) => t.completed >= t.target).length;
    const areas = Map.groupBy(plan.topics, (t) => areaOf(t.label));
    return (
        <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-lg font-semibold">{plan.name} plan</h2>
                    <p className="text-sm text-muted-foreground">
                        {covered} of {plan.topics.length} topics covered · started {plan.createdAt.toLocaleDateString()}
                    </p>
                </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: pct(covered / plan.topics.length) }} />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[...areas].map(([area, topics]) => {
                    const done = topics.filter((t) => t.completed >= t.target).length;
                    return (
                        <Card key={area} className="gap-2 px-4 py-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{areaTitle(area)}</span>
                                <span className="text-xs text-muted-foreground tabular-nums">{done} / {topics.length}</span>
                            </div>
                            <ul className="space-y-1">
                                {topics.map((t) => <TopicRow key={t.label} topic={t} />)}
                            </ul>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}

function TopicRow({ topic: t }: { topic: TopicProgress }) {
    const covered = t.completed >= t.target;
    const icon = covered ? (
        <Check className="size-3.5 text-emerald-400" />
    ) : t.started ? (
        <CircleDashed className="size-3.5 text-amber-400" />
    ) : (
        <Circle className="size-3.5 text-muted-foreground/50" />
    );
    return (
        <li className="flex items-center gap-2 text-[13px]">
            {icon}
            <span className={cn("min-w-0 flex-1 truncate", !covered && "text-muted-foreground")}>{topicName(t.label)}</span>
            {t.bestScore !== null && <span className="text-xs text-muted-foreground tabular-nums">best {t.bestScore}/4</span>}
            {t.available === 0 ? (
                <span className="text-xs text-muted-foreground/60">no exercises yet</span>
            ) : (
                t.next && (
                    <Link href={exampleHref(t.next.name)} className="text-xs underline underline-offset-2">
                        {covered ? "more" : t.started ? "continue" : "start"}
                    </Link>
                )
            )}
        </li>
    );
}

function Saved({ saved }: { saved: Dashboard["saved"] }) {
    return (
        <section>
            <h2 className="mb-3 text-lg font-semibold">Saved exercises</h2>
            {saved.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing saved yet. Use the Save button on an exercise to keep it here.</p>
            ) : (
                <ul className="divide-y rounded-xl border text-sm">
                    {saved.map((s) => (
                        <li key={s.exampleName} className="flex items-center gap-2 px-4 py-2.5">
                            <Link href={exampleHref(s.exampleName)} className="min-w-0 flex-1 truncate hover:underline">{s.title}</Link>
                            {s.topic && <span className="shrink-0 text-xs text-muted-foreground">{topicName(s.topic)}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function Recent({ recent }: { recent: Dashboard["recent"] }) {
    return (
        <section>
            <h2 className="mb-3 text-lg font-semibold">Recent attempts</h2>
            {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No attempts yet. <Link href="/examples" className="text-foreground underline underline-offset-2">Pick an exercise</Link> to start.
                </p>
            ) : (
                <ul className="divide-y rounded-xl border text-sm">
                    {recent.map((a, i) => (
                        <li key={i} className="flex items-center gap-2 px-4 py-2.5">
                            <Link href={exampleHref(a.exampleName)} className="min-w-0 flex-1 truncate hover:underline">{a.title}</Link>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {a.completedAt ? `${a.score}/${a.total}` : `${a.answered}/${a.total} answered`} · {a.updatedAt.toLocaleDateString()}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function DashboardSkeleton() {
    return (
        <div aria-busy aria-label="Loading">
            <Skeleton className="mt-4 mb-8 h-4 w-56" />
            <div className="grid grid-cols-3 gap-3">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
            </div>
            <Skeleton className="mt-10 h-48" />
        </div>
    );
}
