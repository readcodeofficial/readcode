import { randomUUID } from "node:crypto";
import { hashToken, newRefreshToken, signAccessToken } from "./tokens.ts";

export interface RefreshRecord {
    tokenHash: string;
    sessionId: string; // one per signed-in device; stays the same across rotations
    userId: string;
    deviceName: string;
    expiresAt: number;
    revokedAt: number | null;
}

export interface RefreshStore {
    insert(record: RefreshRecord): Promise<void>;
    get(tokenHash: string): Promise<RefreshRecord | null>;
    update(record: RefreshRecord): Promise<void>;
    bySession(sessionId: string): Promise<RefreshRecord[]>;
    byUser(userId: string): Promise<RefreshRecord[]>;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
}

export class InvalidTokenError extends Error {
    constructor() {
        super("refresh token is invalid or expired");
        this.name = "InvalidTokenError";
    }
}

const ACCESS_TTL_MS = 5 * 60_000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;

export class SessionManager {
    private readonly store: RefreshStore;
    private readonly secret: string;
    private readonly now: () => number;

    constructor(store: RefreshStore, secret: string, now: () => number) {
        this.store = store;
        this.secret = secret;
        this.now = now;
    }

    start(userId: string, deviceName: string): Promise<TokenPair> {
        return this.issue(userId, randomUUID(), deviceName);
    }

    // Exchanges a refresh token for a new pair. Each refresh token is single-use (rotation).
    async refresh(refreshToken: string): Promise<TokenPair> {
        const t = this.now();
        const record = await this.store.get(hashToken(refreshToken));
        if (!record || record.expiresAt <= t) throw new InvalidTokenError();

        await this.store.update({ ...record, revokedAt: t });
        return this.issue(record.userId, record.sessionId, record.deviceName);
    }

    // Signs this device out.
    async logout(refreshToken: string): Promise<void> {
        const record = await this.store.get(hashToken(refreshToken));
        if (record) await this.revokeSession(record.sessionId, this.now());
    }

    // After a password change: every device has to sign in again.
    async logoutEverywhere(userId: string): Promise<void> {
        const t = this.now();
        for (const r of await this.store.byUser(userId)) if (r.revokedAt === null) await this.store.update({ ...r, revokedAt: t });
    }

    // Devices that are still signed in, for the account page.
    async activeDevices(userId: string): Promise<string[]> {
        const t = this.now();
        const live = (await this.store.byUser(userId)).filter((r) => r.revokedAt === null && r.expiresAt > t);
        return [...new Set(live.map((r) => r.deviceName))].sort();
    }

    private async revokeSession(sessionId: string, t: number): Promise<void> {
        for (const r of await this.store.bySession(sessionId)) if (r.revokedAt === null) await this.store.update({ ...r, revokedAt: t });
    }

    private async issue(userId: string, sessionId: string, deviceName: string): Promise<TokenPair> {
        const t = this.now();
        const refreshToken = newRefreshToken();
        await this.store.insert({ tokenHash: hashToken(refreshToken), sessionId, userId, deviceName, expiresAt: t + REFRESH_TTL_MS, revokedAt: null });
        const accessToken = signAccessToken({ sub: userId, sid: sessionId, exp: t + ACCESS_TTL_MS }, this.secret);
        return { accessToken, refreshToken, sessionId };
    }
}
