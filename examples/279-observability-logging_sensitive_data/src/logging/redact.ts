// Fields that may hold PHI or credentials. Matched case-insensitively, ignoring _ and -.
const SENSITIVE_KEYS = new Set([
    "ssn",
    "dateofbirth",
    "dob",
    "phone",
    "email",
    "address",
    "insuranceid",
    "diagnosis",
    "notes",
    "password",
    "token",
]);

const EMAIL = /[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}/gi;
const MAX_DEPTH = 8;

const normalize = (key: string) => key.toLowerCase().replace(/[_-]/g, "");

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

// Free text (messages, error strings) can still contain addresses typed in by staff.
export function redactText(text: string): string {
    return text.replace(EMAIL, "[email]");
}

// Returns a copy of value that is safe to log. The input is never modified.
export function redact(value: unknown, depth = 0): unknown {
    if (depth > MAX_DEPTH) return "[truncated]";
    if (typeof value === "string") return redactText(value);
    if (value instanceof Error) return { name: value.name, message: redactText(value.message) };
    if (isPlainObject(value)) {
        const out: Record<string, unknown> = {};
        for (const [key, v] of Object.entries(value)) {
            out[key] = SENSITIVE_KEYS.has(normalize(key)) ? "[redacted]" : redact(v, depth + 1);
        }
        return out;
    }
    return value;
}
