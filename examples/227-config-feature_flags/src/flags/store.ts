import { isEnabled, type FlagConfig } from "./evaluate.ts";

// Holds the flag set pushed by the config service. Reloaded every 30s.
export class FlagStore {
    private flags = new Map<string, FlagConfig>();

    load(raw: string): void {
        const parsed = JSON.parse(raw) as FlagConfig[];
        const next = new Map<string, FlagConfig>();
        for (const flag of parsed) next.set(flag.key, flag);
        this.flags = next;
    }

    isEnabled(key: string, userId: string): boolean {
        return isEnabled(this.flags.get(key), userId);
    }
}
