export type Plan = "free" | "pro" | "team";

export interface UserFields {
    name: string;
    email: string;
    plan: Plan;
}

const PLANS: readonly string[] = ["free", "pro", "team"];
const FIELDS = ["name", "email", "plan"] as const;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

// PUT needs every field; PATCH accepts any subset. Unknown fields are rejected in both cases.
export function parseUserFields(body: unknown, partial: false): Parsed<UserFields>;
export function parseUserFields(body: unknown, partial: true): Parsed<Partial<UserFields>>;
export function parseUserFields(body: unknown, partial: boolean): Parsed<Partial<UserFields>> {
    if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "body must be a JSON object" };
    const input = body as Record<string, unknown>;

    const unknown = Object.keys(input).filter((k) => !(FIELDS as readonly string[]).includes(k));
    if (unknown.length) return { ok: false, error: `unknown field(s): ${unknown.join(", ")}` };

    const out: Partial<UserFields> = {};
    for (const field of FIELDS) {
        const v = input[field];
        if (v === undefined) {
            if (!partial) return { ok: false, error: `${field} is required` };
            continue;
        }
        if (typeof v !== "string" || v.trim() === "") return { ok: false, error: `${field} must be a non-empty string` };
        if (field === "email" && !/^[^@\s]+@[^@\s]+$/.test(v)) return { ok: false, error: "email is invalid" };
        if (field === "plan" && !PLANS.includes(v)) return { ok: false, error: `plan must be one of ${PLANS.join(", ")}` };
        (out as Record<string, string>)[field] = v.trim();
    }
    return { ok: true, value: out };
}
