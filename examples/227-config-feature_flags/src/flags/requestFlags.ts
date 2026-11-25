import type { FlagStore } from "./store.ts";

export interface Exposure {
    flag: string;
    userId: string;
    enabled: boolean;
}

// Evaluates the flags a page needs, once per request, and reports each exposure for analytics.
export function flagsForRequest(
    store: Pick<FlagStore, "isEnabled">,
    userId: string | null,
    keys: string[],
    expose: (e: Exposure) => void = () => {},
): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const key of new Set(keys)) {
        // anonymous visitors have no stable id to bucket on, so unreleased features stay off
        if (userId === null) {
            result[key] = false;
            continue;
        }
        const enabled = store.isEnabled(key, userId);
        result[key] = enabled;
        expose({ flag: key, userId, enabled });
    }
    return result;
}
