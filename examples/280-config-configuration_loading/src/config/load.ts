import { DEFAULTS, type RideConfig } from "./defaults.ts";

type Json = Record<string, unknown>;
export type Env = Record<string, string | undefined>;

const PREFIX = "RIDES__";

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const camel = (s: string) => s.toLowerCase().replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function coerce(key: string, raw: string, like: unknown): unknown {
    if (typeof like === "number") {
        const n = Number(raw);
        if (raw.trim() === "" || !Number.isFinite(n)) throw new Error(`${key} must be a number, got "${raw}"`);
        return n;
    }
    if (typeof like === "boolean") {
        if (raw !== "true" && raw !== "false") throw new Error(`${key} must be true or false, got "${raw}"`);
        return raw === "true";
    }
    if (Array.isArray(like)) return raw.split(",").map((s) => s.trim()).filter(Boolean);
    return raw;
}

// RIDES__PRICING__SURGE_CAP=2.5 becomes { pricing: { surgeCap: 2.5 } }, typed like the default.
export function fromEnv(env: Env): Json {
    const out: Json = {};
    for (const [key, raw] of Object.entries(env)) {
        if (!key.startsWith(PREFIX) || raw === undefined) continue;
        const path = key.slice(PREFIX.length).split("__").map(camel);
        let target = out;
        let shape: unknown = DEFAULTS;
        path.forEach((part, i) => {
            shape = isObject(shape) ? shape[part] : undefined;
            if (shape === undefined) throw new Error(`unknown setting ${key}`);
            if (i === path.length - 1) target[part] = coerce(key, raw, shape);
            else target = (target[part] ??= {}) as Json;
        });
    }
    return out;
}

// Later layers win.
function merge(base: Json, override: Json): Json {
    const out: Json = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (value !== undefined) out[key] = value;
    }
    return out;
}

function validate(c: RideConfig): RideConfig {
    const p = c.pricing;
    for (const k of ["baseFareCents", "perKmCents", "perMinuteCents", "minimumFareCents"] as const) {
        if (!Number.isInteger(p[k]) || p[k] < 0) throw new Error(`pricing.${k} must be a non-negative integer`);
    }
    if (!(p.surgeCap >= 1 && p.surgeCap <= 5)) throw new Error("pricing.surgeCap must be between 1 and 5");
    if (!(c.dispatch.searchRadiusKm > 0)) throw new Error("dispatch.searchRadiusKm must be positive");
    if (!(c.dispatch.maxEtaMinutes > 0)) throw new Error("dispatch.maxEtaMinutes must be positive");
    if (!Array.isArray(c.dispatch.vehicleClasses) || c.dispatch.vehicleClasses.length === 0) throw new Error("dispatch.vehicleClasses must not be empty");
    return c;
}

// Defaults, then the city's config file, then environment variables.
export function loadConfig(env: Env, cityFile: unknown = {}): RideConfig {
    if (!isObject(cityFile)) throw new Error("city config file must contain a JSON object");
    const layers = [DEFAULTS as unknown as Json, cityFile, fromEnv(env)];
    return validate(layers.reduce((acc, layer) => merge(acc, layer), {}) as unknown as RideConfig);
}
