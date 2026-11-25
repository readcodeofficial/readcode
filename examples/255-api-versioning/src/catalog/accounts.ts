import { CHANGES, SUPPORTED_VERSIONS } from "./versions.ts";

export interface Account {
    id: string;
    pinnedVersion: string;
}

export interface AccountStore {
    get(id: string): Promise<Account | null>;
    save(account: Account): Promise<void>;
}

export type UpgradeResult =
    | { ok: true; account: Account; changes: string[] }
    | { ok: false; error: string };

// Developer dashboard: "Upgrade API version". Lists the breaking changes the partner is
// accepting. Pins only move forward; testing an older version is done per request with the header.
export async function upgradePinnedVersion(store: AccountStore, accountId: string, target: string): Promise<UpgradeResult> {
    const account = await store.get(accountId);
    if (!account) return { ok: false, error: `Unknown account ${accountId}` };
    if (!SUPPORTED_VERSIONS.includes(target)) return { ok: false, error: `Unknown version ${target}` };
    if (target < account.pinnedVersion) return { ok: false, error: "Pinned versions can't be downgraded" };

    const changes = CHANGES.filter((c) => c.version > account.pinnedVersion && c.version <= target).map((c) => `${c.version}: ${c.description}`);
    const updated = { ...account, pinnedVersion: target };
    await store.save(updated);
    return { ok: true, account: updated, changes };
}
