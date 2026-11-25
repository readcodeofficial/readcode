import { fnv1a } from "./hash.ts";

export interface FlagConfig {
    key: string;
    enabled: boolean; // global kill switch
    rolloutPercent: number; // 0..100
    allowUsers: string[];
    denyUsers: string[];
}

// 0..99, the same for a given flag and user on every server.
export function bucketOf(flagKey: string, userId: string): number {
    return fnv1a(`${flagKey}:${userId}`) % 100;
}

export function isEnabled(flag: FlagConfig | undefined, userId: string): boolean {
    if (!flag || !flag.enabled) return false;
    if (flag.denyUsers.includes(userId)) return false;
    if (flag.allowUsers.includes(userId)) return true;
    const percent = Math.min(100, Math.max(0, flag.rolloutPercent));
    return bucketOf(flag.key, userId) <= percent;
}
