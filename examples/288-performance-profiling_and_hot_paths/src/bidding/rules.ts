import type { BidRequest, Matcher } from "./types.ts";

// Targeting expressions are clauses joined by "and", each optionally negated with "!":
//   country in [PT,ES]   device:phone   segment:sports   hour in 18..23
// Parsing is the expensive part, so callers compile a rule once and reuse the Matcher.
export function compileRule(rule: string): Matcher {
    const clauses = rule
        .split(/\s+and\s+/i)
        .map((c) => c.trim())
        .filter(Boolean)
        .map(compileClause);
    return (req) => clauses.every((matches) => matches(req));
}

function compileClause(source: string): Matcher {
    const negated = source.startsWith("!");
    const text = negated ? source.slice(1).trim() : source;
    const matcher = parseClause(text);
    return negated ? (req) => !matcher(req) : matcher;
}

function parseClause(text: string): Matcher {
    let m = /^country in \[([A-Z]{2}(?:\s*,\s*[A-Z]{2})*)\]$/.exec(text);
    if (m) {
        const countries = new Set(m[1].split(",").map((s) => s.trim()));
        return (req) => countries.has(req.country);
    }
    m = /^hour in (\d{1,2})\.\.(\d{1,2})$/.exec(text);
    if (m) {
        const [from, to] = [Number(m[1]), Number(m[2])];
        if (from > 23 || to > 23) throw new Error(`Bad hour range in "${text}"`);
        return from <= to ? (req) => req.hour >= from && req.hour <= to : (req) => req.hour >= from || req.hour <= to;
    }
    m = /^device:(phone|tablet|desktop|ctv)$/.exec(text);
    if (m) {
        const device = m[1];
        return (req) => req.device === device;
    }
    m = /^segment:([a-z0-9_-]+)$/.exec(text);
    if (m) {
        const segment = m[1];
        return (req: BidRequest) => req.segments.includes(segment);
    }
    throw new Error(`Unknown targeting clause "${text}"`);
}
