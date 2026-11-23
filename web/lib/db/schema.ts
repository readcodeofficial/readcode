// Database tables. Change this file, then run `npm run db:generate` to write a migration into drizzle/.
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import type { DefectLocation, Plan } from "../../../shared/types";

// ---- auth (Better Auth's tables; field names must match what it expects) ----

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
    "session",
    {
        id: text("id").primaryKey(),
        expiresAt: timestamp("expires_at").notNull(),
        token: text("token").notNull().unique(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull(),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    },
    (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
    "account",
    {
        id: text("id").primaryKey(),
        accountId: text("account_id").notNull(),
        providerId: text("provider_id").notNull(),
        userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
        accessToken: text("access_token"),
        refreshToken: text("refresh_token"),
        idToken: text("id_token"),
        accessTokenExpiresAt: timestamp("access_token_expires_at"),
        refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
        scope: text("scope"),
        password: text("password"),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull(),
    },
    (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
    "verification",
    {
        id: text("id").primaryKey(),
        identifier: text("identifier").notNull(),
        value: text("value").notNull(),
        expiresAt: timestamp("expires_at").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---- app ----
// Examples live as folders in git, so these tables refer to them by folder name
// (e.g. "examples/092-security-authentication"), not by foreign key.

// A user's study plan: how many exercises to complete per taxonomy topic.
export const plan = pgTable(
    "plan",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        kind: text("kind").$type<"breadth">().notNull(),
        taxonomyVersion: text("taxonomy_version").notNull(),
        targets: jsonb("targets").$type<Plan["targets"]>().notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        archivedAt: timestamp("archived_at"),
    },
    (t) => [index("plan_user_id_idx").on(t.userId)],
);

// An exercise the user bookmarked.
export const savedExample = pgTable(
    "saved_example",
    {
        userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
        exampleName: text("example_name").notNull(),
        createdAt: timestamp("created_at").notNull().defaultNow(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.exampleName] })],
);

// A submitted answer: a choice index for a multiple-choice question, or for a locate
// question the marked lines or "none" (the user answered that there is no defect).
export type SubmittedAnswer = number | DefectLocation | "none";

// One run through an exercise. answers[i] / correct[i] are null until question i is submitted.
// "Reset" in the viewer starts a new attempt, so earlier scores are kept.
export const attempt = pgTable(
    "attempt",
    {
        id: text("id").primaryKey(),
        userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
        exampleName: text("example_name").notNull(),
        answers: jsonb("answers").$type<(SubmittedAnswer | null)[]>().notNull(),
        correct: jsonb("correct").$type<(boolean | null)[]>().notNull(),
        score: integer("score").notNull().default(0),            // correct answers so far
        completedAt: timestamp("completed_at"),                   // set once every question is answered
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow(),
    },
    (t) => [index("attempt_user_example_idx").on(t.userId, t.exampleName)],
);
