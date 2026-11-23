// Grading, shared by the viewer (instant feedback) and the server (what gets saved).
import { z } from "zod";
import type { ExampleKey, LocateAnswer, Question } from "../../shared/types";
import { DefectLocation } from "../../shared/types";
import type { SubmittedAnswer } from "./db/schema";

// A marked range counts as correct if it overlaps the defect, allowing this many lines either side.
export const LINE_TOLERANCE = 1;

// What a client may submit for one question; validated on the server.
export const SubmittedAnswerSchema = z.union([z.number().int().nonnegative(), z.literal("none"), DefectLocation]);

// null when the answer doesn't fit the question (e.g. a choice index for a locate question).
export function gradeAnswer(question: Question, keyAnswer: ExampleKey["answers"][number], answer: SubmittedAnswer): boolean | null {
    if (question.kind === "locate") {
        if (typeof answer === "number" || typeof keyAnswer === "number") return null;
        return locateCorrect(answer, keyAnswer);
    }
    if (typeof answer !== "number" || answer >= question.choices.length) return null;
    return answer === keyAnswer;
}

export function locateCorrect(mark: DefectLocation | "none" | null, answer: LocateAnswer): boolean {
    if (mark === null) return false;
    if (answer.defect === null) return mark === "none";
    if (mark === "none" || mark.path !== answer.defect.path) return false;
    return mark.startLine <= answer.defect.endLine + LINE_TOLERANCE && mark.endLine >= answer.defect.startLine - LINE_TOLERANCE;
}
