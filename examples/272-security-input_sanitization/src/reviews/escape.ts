// Output encoding for user-written text placed into HTML (element content or double-quoted attributes).
export function escapeHtml(value: string): string {
    return value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&#39;");
}

// Links from users may only be http(s); anything else (javascript:, data:, relative junk) is dropped.
export function safeUrl(raw: string | undefined): string | null {
    if (!raw) return null;
    try {
        const url = new URL(raw.trim());
        return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
    } catch {
        return null;
    }
}
