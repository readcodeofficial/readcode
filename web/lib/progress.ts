// Server-only reads and writes of a user's plans, saved exercises and attempts.
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { attempt, plan, savedExample, type SubmittedAnswer } from "./db/schema";
import { listExamples, type ExampleSummary } from "./examples";
import { loadTaxonomy } from "./taxonomy";

// ---- one exercise ----

export type ExampleState = {
    attempt: { id: string; answers: (SubmittedAnswer | null)[] } | null; // latest attempt, to resume
    saved: boolean;
};

export async function getExampleState(userId: string, exampleName: string): Promise<ExampleState> {
    const [latest, saved] = await Promise.all([
        db.select({ id: attempt.id, answers: attempt.answers }).from(attempt)
            .where(and(eq(attempt.userId, userId), eq(attempt.exampleName, exampleName)))
            .orderBy(desc(attempt.updatedAt)).limit(1),
        db.select({ name: savedExample.exampleName }).from(savedExample)
            .where(and(eq(savedExample.userId, userId), eq(savedExample.exampleName, exampleName))),
    ]);
    return { attempt: latest[0] ?? null, saved: saved.length > 0 };
}

// ---- plans ----

// A plan to cover the whole field: one completed exercise in every taxonomy topic.
export async function createBreadthPlan(userId: string): Promise<void> {
    const taxonomy = await loadTaxonomy();
    await db.update(plan).set({ archivedAt: new Date() }).where(and(eq(plan.userId, userId), isNull(plan.archivedAt)));
    await db.insert(plan).values({
        id: crypto.randomUUID(),
        userId,
        name: "Full field",
        kind: "breadth",
        taxonomyVersion: taxonomy.version,
        targets: taxonomy.labels.map((label) => ({ label, count: 1 })),
    });
}

export type TopicProgress = {
    label: string;
    target: number;
    completed: number;             // completed exercises in this topic, capped at target
    started: boolean;              // any attempt in this topic
    bestScore: number | null;      // best score among completed exercises (out of 4)
    available: number;             // exercises that exist for this topic
    next: ExampleSummary | null;   // first exercise in the topic the user hasn't completed
};

export type Dashboard = {
    plan: { id: string; name: string; createdAt: Date; topics: TopicProgress[] } | null;
    saved: { exampleName: string; title: string; topic: string; savedAt: Date }[];
    recent: { exampleName: string; title: string; topic: string; score: number; answered: number; total: number; completedAt: Date | null; updatedAt: Date }[];
    stats: { completed: number; questionsAnswered: number; correct: number };
};

export async function getDashboard(userId: string): Promise<Dashboard> {
    const [plans, saved, attempts, examples] = await Promise.all([
        db.select().from(plan).where(and(eq(plan.userId, userId), isNull(plan.archivedAt))).orderBy(desc(plan.createdAt)).limit(1),
        db.select().from(savedExample).where(eq(savedExample.userId, userId)).orderBy(desc(savedExample.createdAt)),
        db.select().from(attempt).where(eq(attempt.userId, userId)).orderBy(desc(attempt.updatedAt)),
        listExamples(),
    ]);
    const byName = new Map(examples.map((e) => [e.name, e]));
    const byTopic = Map.groupBy(examples, (e) => e.topic);

    // best completed score per exercise, and which exercises were started at all
    const best = new Map<string, number>();
    const started = new Set<string>();
    for (const a of attempts) {
        started.add(a.exampleName);
        if (a.completedAt) best.set(a.exampleName, Math.max(best.get(a.exampleName) ?? 0, a.score));
    }

    const active = plans[0];
    const topics = active?.targets.map(({ label, count }): TopicProgress => {
        const inTopic = byTopic.get(label) ?? [];
        const done = inTopic.filter((e) => best.has(e.name));
        return {
            label,
            target: count,
            completed: Math.min(count, done.length),
            started: inTopic.some((e) => started.has(e.name)),
            bestScore: done.length ? Math.max(...done.map((e) => best.get(e.name)!)) : null,
            available: inTopic.length,
            next: inTopic.find((e) => !best.has(e.name)) ?? null,
        };
    });

    return {
        plan: active ? { id: active.id, name: active.name, createdAt: active.createdAt, topics: topics! } : null,
        saved: saved.map((s) => ({
            exampleName: s.exampleName,
            title: byName.get(s.exampleName)?.shortName ?? s.exampleName,
            topic: byName.get(s.exampleName)?.topic ?? "",
            savedAt: s.createdAt,
        })),
        recent: attempts.slice(0, 10).map((a) => ({
            exampleName: a.exampleName,
            title: byName.get(a.exampleName)?.shortName ?? a.exampleName,
            topic: byName.get(a.exampleName)?.topic ?? "",
            score: a.score,
            answered: a.answers.filter((x) => x !== null).length,
            total: a.answers.length,
            completedAt: a.completedAt,
            updatedAt: a.updatedAt,
        })),
        stats: {
            completed: attempts.filter((a) => a.completedAt).length,
            questionsAnswered: attempts.reduce((n, a) => n + a.answers.filter((x) => x !== null).length, 0),
            correct: attempts.reduce((n, a) => n + a.score, 0),
        },
    };
}
