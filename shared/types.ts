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

export const Question = z.union([LocateDefect, MultipleChoice]);
export type Question = z.infer<typeof Question>;

export const ExamplePublic = z.object({
  id: z.string(),
  title: z.string(),
  name: z.string().optional(),        // short display name, 2-4 words (older examples have none)
  createdAt: z.string(),
  durationMinutes: z.number().int().positive(),
  language: z.string(),
  questions: z.array(Question).length(4),
  taxonomyVersion: z.string(),        // taxonomy the concept labels come from
  concepts: z.array(LabelId),         // taxonomy labels covered, for bank counts
});
export type ExamplePublic = z.infer<typeof ExamplePublic>;

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

// answers[i] and explanations[i] correspond to ExamplePublic.questions[i]:
// a choice index for a multiple-choice question, a LocateAnswer for a locate question.
export const ExampleKey = z.object({
  answers: z.array(z.union([z.number().int().nonnegative(), LocateAnswer])).length(4),
  explanations: z.array(z.string()).length(4).optional(),   // shown after the question is submitted
});
export type ExampleKey = z.infer<typeof ExampleKey>;

// a code file of the example, written under src/<path>
export const SourceFile = z.object({
  path: z.string(),                   // relative, e.g. "fares/calculator.ts"
  content: z.string(),
});
export type SourceFile = z.infer<typeof SourceFile>;

export const Example = z.object({
  public: ExamplePublic,
  key: ExampleKey,
  files: z.array(SourceFile).min(1),
});
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
