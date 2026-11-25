export type EnvName = "development" | "test" | "preview" | "staging" | "production";

export interface Settings {
    name: EnvName;
    isProduction: boolean;
    bank: { mode: "live" | "sandbox"; baseUrl: string };
    // Non-production environments send every email here instead of to employees.
    emailRedirect: string | null;
    // Live payroll runs need a second person to sign off.
    requireApproval: boolean;
    logLevel: "debug" | "info";
}

const KNOWN: readonly EnvName[] = ["development", "test", "preview", "staging", "production"];
const ALIASES: Record<string, EnvName> = { dev: "development", ci: "test", stage: "staging", prod: "production" };

const LIVE_BANK = "https://api.bank.example/v2";
const SANDBOX_BANK = "https://sandbox.bank.example/v2";

// Resolves the deployment environment from variables passed in by the entry point (normally process.env).
export function resolveEnvironment(vars: Record<string, string | undefined>): Settings {
    const raw = (vars.APP_ENV ?? "development").trim().toLowerCase();
    const name = (ALIASES[raw] ?? raw) as EnvName;
    if (!KNOWN.includes(name)) throw new Error(`unknown APP_ENV "${vars.APP_ENV}"`);

    // Local machines, CI and the shared staging stack never touch real money or real inboxes.
    const safe = name === "development" || name === "test" || name === "staging";
    const isProduction = !safe;

    return {
        name,
        isProduction,
        bank: isProduction ? { mode: "live", baseUrl: LIVE_BANK } : { mode: "sandbox", baseUrl: SANDBOX_BANK },
        emailRedirect: isProduction ? null : (vars.EMAIL_REDIRECT ?? "payroll-qa@corp.example"),
        requireApproval: isProduction,
        logLevel: isProduction ? "info" : "debug",
    };
}
