import type { AuditLog, Session } from "./changeRoles.ts";

export interface Accounts {
    isSuspended(userId: string): Promise<boolean | null>; // null = no such user
    setSuspended(userId: string, suspended: boolean): Promise<void>;
    revokeSessions(userId: string): Promise<number>; // returns how many sessions were ended
}

export interface SuspendRequest {
    targetUserId: string;
    suspend: boolean;
    reason: string;
}

// POST /admin/users/:id/suspension
export async function setSuspension(
    session: Session,
    req: SuspendRequest,
    deps: { accounts: Accounts; audit: AuditLog; now: () => Date },
): Promise<{ status: number; body: unknown }> {
    const action = req.suspend ? "user.suspend" : "user.unsuspend";
    const entry = { at: deps.now().toISOString(), actorId: session.userId, action, targetId: req.targetUserId, ip: session.ip, reason: req.reason };

    if (!session.roles.includes("admin")) {
        await deps.audit.write({ ...entry, outcome: "denied" });
        return { status: 403, body: { error: "forbidden" } };
    }
    if (req.targetUserId === session.userId) return { status: 400, body: { error: "you can't suspend yourself" } };
    if (req.reason.trim().length < 5) return { status: 400, body: { error: "a reason is required" } };

    const current = await deps.accounts.isSuspended(req.targetUserId);
    if (current === null) return { status: 404, body: { error: "user not found" } };
    if (current === req.suspend) return { status: 200, body: { suspended: current, changed: false } };

    await deps.accounts.setSuspended(req.targetUserId, req.suspend);
    const revoked = req.suspend ? await deps.accounts.revokeSessions(req.targetUserId) : 0;
    await deps.audit.write({ ...entry, outcome: "success" });
    return { status: 200, body: { suspended: req.suspend, changed: true, sessionsRevoked: revoked } };
}
