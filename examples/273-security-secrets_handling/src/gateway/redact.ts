// Makes a copy of any config-like value that is safe to log or show on a diagnostics page.
// Fields whose name marks them as credentials are masked, and passwords embedded in URLs are hidden.
const SECRET_FIELD = /(password|secret|token|key)$/;
const MASK = "[redacted]";

function maskUrlCredentials(value: string): string {
    if (!value.includes("://")) return value;
    try {
        const url = new URL(value);
        if (!url.password) return value;
        url.password = "***";
        return url.href;
    } catch {
        return value;
    }
}

export function redact(value: unknown, fieldName = ""): unknown {
    if (SECRET_FIELD.test(fieldName) && value !== "" && value !== undefined) return MASK;
    if (Array.isArray(value)) return value.map((item) => redact(item));
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
    }
    if (typeof value === "string") return maskUrlCredentials(value);
    return value;
}
