import { z } from "zod";

///////////
// Taxonomy
///////////
export const LabelId = z.string();                // e.g. "backend.concurrency.race_conditions"
export type LabelId = z.infer<typeof LabelId>;

export const Taxonomy = z.object({
  version: z.string(),
  createdAt: z.string(),
  labels: z.array(LabelId),
});
export type Taxonomy = z.infer<typeof Taxonomy>;

///////////
// Classification
///////////
export type WeightVector = number[];              // dense, in taxonomy.labels order
export type LabelWeights = Record<LabelId, number>; // robust to version changes in taxonomy

// The programming languages the classifier may name (pipeline/taxonomy/languages.json), like the taxonomy for concepts.
export const LanguageList = z.object({
  version: z.string(),
  createdAt: z.string(),
  languages: z.array(z.string()),
});
export type LanguageList = z.infer<typeof LanguageList>;

// Programming languages a posting calls for, each scored 0-1 like topic weights (not shares):
// { Java: 1.0, Kotlin: 0.4 } = Java required, Kotlin a plus. Normalize where shares are needed.
export const LanguageWeights = z.record(z.string(), z.number().min(0).max(1));
export type LanguageWeights = z.infer<typeof LanguageWeights>;

export interface Classification {
  taxonomyVersion: string;
  weights: WeightVector;
  languages: LanguageWeights;
}

// How natural each language is as the setting for an exercise on each topic, in backend work
// (pipeline/taxonomy/language_fit.json; evidence in docs/LANGUAGE_FIT.md). 1.0 = a mainstream home of the
// topic, 0 = doesn't really arise. Planning uses it so a topic only gets languages that suit it.
export const LanguageFit = z.object({
  version: z.string(),
  taxonomyVersion: z.string(),
  languages: z.array(z.string()),
  topics: z.record(LabelId, z.object({
    weights: z.record(z.string(), z.number().min(0).max(1)),
    rationale: z.string(),
    sources: z.array(z.object({ url: z.string(), supports: z.string() })).min(1),
  })),
});
export type LanguageFit = z.infer<typeof LanguageFit>;

///////////
// Job Posting
///////////
export interface JobPosting {
  link: string;
  company: string;
  title: string;
  description: string;
  date: Date;
}

///////////
// Example
///////////
// a code file of the example, written under src/<path>
export const SourceFile = z.object({
  path: z.string(),                   // relative, e.g. "fares/calculator.ts"
  content: z.string(),
});
export type SourceFile = z.infer<typeof SourceFile>;

// A question is either multiple choice, or "locate the defect": the candidate marks the
// defective lines in the code, or answers that there is no defect.
// `kind` is optional so examples written before it existed (all multiple choice) still parse.
export const MultipleChoice = z.object({
  kind: z.literal("choice").optional(),
  prompt: z.string(),
  choices: z.array(z.string()).min(2),
});
export type MultipleChoice = z.infer<typeof MultipleChoice>;

export const LocateDefect = z.object({
  kind: z.literal("locate"),
  prompt: z.string(),
});
export type LocateDefect = z.infer<typeof LocateDefect>;

// "Fix the bug": the candidate edits the listed src/ files in the editor and runs the tests.
// Correct when every test passes. Tests are node:test files, run from a tests/ folder next
// to src/, so they import the code as "../src/<path>".
export const FixBug = z.object({
  kind: z.literal("fix"),
  prompt: z.string(),
  editable: z.array(z.string()).min(1),   // src/ paths the candidate may change
  tests: z.array(SourceFile).min(1),      // shown read-only under tests/
});
export type FixBug = z.infer<typeof FixBug>;

// locate and fix come first: MultipleChoice's kind is optional, so it would match anything with a prompt
export const Question = z.union([LocateDefect, FixBug, MultipleChoice]);
export type Question = z.infer<typeof Question>;

export const ExamplePublic = z.object({
  id: z.string(),
  title: z.string(),
  name: z.string().optional(),        // short display name, 2-4 words (older examples have none)
  createdAt: z.string(),
  durationMinutes: z.number().int().positive(),
  language: z.string(),
  // comprehension exercises: 4 (locate + 3 multiple choice); bug-fix exercises: 1 (the fix)
  questions: z.array(Question).min(1),
  taxonomyVersion: z.string(),        // taxonomy the concept labels come from
  concepts: z.array(LabelId),         // taxonomy labels covered, for bank counts
});
export type ExamplePublic = z.infer<typeof ExamplePublic>;

// The exercise's type, shown as a tag in the UI: "bugfix" if any question asks for a fix
// that is run against tests, otherwise "comprehension" (reading questions only).
export type ExerciseKind = "bugfix" | "comprehension";
export function exerciseKind(pub: { questions?: { kind?: string }[] }): ExerciseKind {
  return pub.questions?.some((q) => q.kind === "fix") ? "bugfix" : "comprehension";
}

// Where the defect is: 1-based, inclusive line range in one file (path relative to src/).
export const DefectLocation = z.object({
  path: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
});
export type DefectLocation = z.infer<typeof DefectLocation>;

// Answer to a locate question: the defect's location, or null when the code has no defect.
export const LocateAnswer = z.object({
  defect: DefectLocation.nullable(),
});
export type LocateAnswer = z.infer<typeof LocateAnswer>;

// Answer to a fix question: a reference fix, shown after submission. Grading is by the tests.
export const FixAnswer = z.object({
  solution: z.array(SourceFile),          // the fixed versions of the editable files
});
export type FixAnswer = z.infer<typeof FixAnswer>;

// answers[i] and explanations[i] correspond to ExamplePublic.questions[i]:
// a choice index for a multiple-choice question, a LocateAnswer for a locate question,
// a FixAnswer for a fix question.
export const ExampleKey = z.object({
  answers: z.array(z.union([z.number().int().nonnegative(), LocateAnswer, FixAnswer])).min(1),
  explanations: z.array(z.string()).min(1).optional(),   // shown after the question is submitted
});
export type ExampleKey = z.infer<typeof ExampleKey>;

// Result of running a fix question's tests.
export const RunResult = z.object({
  tests: z.array(z.object({
    name: z.string(),
    status: z.enum(["pass", "fail", "skip"]),
    durationMs: z.number().optional(),
    message: z.string().optional(),   // failure reason
  })),
  output: z.string(),                 // the tests' stdout + stderr
  exitCode: z.number().nullable(),
  timedOut: z.boolean(),
  error: z.string().optional(),       // the run itself couldn't happen
});
export type RunResult = z.infer<typeof RunResult>;

export const Example = z
  .object({
    public: ExamplePublic,
    key: ExampleKey,
    files: z.array(SourceFile).min(1),
  })
  .refine((e) => e.key.answers.length === e.public.questions.length, "key.answers must have one entry per question")
  .refine((e) => !e.key.explanations || e.key.explanations.length === e.public.questions.length, "key.explanations must have one entry per question");
export type Example = z.infer<typeof Example>;

///////////
// Plan (per job posting, computed once)
///////////
export const Plan = z.object({
  taxonomyVersion: z.string(),
  targets: z.array(z.object({
    label: LabelId,
    // language of the examples; plans written before languages existed were all TypeScript
    language: z.string().default("TypeScript"),
    count: z.number().int().positive(),      // examples to make for this topic in this language
  })),
});
export type Plan = z.infer<typeof Plan>;
