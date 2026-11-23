"use server";
// Server actions for signed-in users. Inputs come from the browser, so everything is checked here:
// the example must exist, and answers are graded against key.json on the server.
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { attempt, savedExample } from "@/lib/db/schema";
import { loadExample } from "@/lib/examples";
import { gradeAnswer, SubmittedAnswerSchema } from "@/lib/grading";
import { createBreadthPlan } from "@/lib/progress";

const SubmitInput = z.object({
    exampleName: z.string().min(1),
    attemptId: z.string().nullable(),   // null starts a new attempt
    questionIndex: z.number().int().nonnegative(),
    answer: SubmittedAnswerSchema,
});

export type SubmitResult = { ok: true; attemptId: string; correct: boolean } | { ok: false; error: string };

// Grade one answer and record it on the attempt. A question can be answered once per attempt.
export async function submitAnswer(input: z.infer<typeof SubmitInput>): Promise<SubmitResult> {
    const user = await currentUser();
    if (!user) return { ok: false, error: "Not signed in" };
    const parsed = SubmitInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid answer" };
    const { exampleName, attemptId, questionIndex: qi, answer } = parsed.data;

    const example = await loadExample(exampleName);
    const question = example?.public.questions[qi];
    if (!example || !question) return { ok: false, error: "Unknown question" };
    const correct = gradeAnswer(question, example.key.answers[qi], answer);
    if (correct === null) return { ok: false, error: "Answer doesn't fit the question" };

    const n = example.public.questions.length;
    const row = attemptId
        ? (await db.select().from(attempt).where(and(eq(attempt.id, attemptId), eq(attempt.userId, user.id))))[0]
        : undefined;
    if (attemptId && (!row || row.exampleName !== exampleName)) return { ok: false, error: "Unknown attempt" };
    if (row && row.answers[qi] !== null) return { ok: false, error: "Already answered" };

    const answers = row?.answers ?? Array(n).fill(null);
    const marks = row?.correct ?? Array(n).fill(null);
    answers[qi] = answer;
    marks[qi] = correct;
    const values = {
        answers,
        correct: marks,
        score: marks.filter((m) => m === true).length,
        completedAt: answers.every((a) => a !== null) ? new Date() : null,
        updatedAt: new Date(),
    };

    let id = row?.id;
    if (row) await db.update(attempt).set(values).where(eq(attempt.id, row.id));
    else {
        id = crypto.randomUUID();
        await db.insert(attempt).values({ id, userId: user.id, exampleName, ...values });
    }
    return { ok: true, attemptId: id!, correct };
}

export async function setSaved(exampleName: string, saved: boolean): Promise<{ ok: boolean }> {
    const user = await currentUser();
    if (!user || !(await loadExample(exampleName))) return { ok: false };
    if (saved) await db.insert(savedExample).values({ userId: user.id, exampleName }).onConflictDoNothing();
    else await db.delete(savedExample).where(and(eq(savedExample.userId, user.id), eq(savedExample.exampleName, exampleName)));
    revalidatePath("/me");
    return { ok: true };
}

export async function startBreadthPlan(): Promise<void> {
    const user = await currentUser();
    if (!user) return;
    await createBreadthPlan(user.id);
    revalidatePath("/me");
}
