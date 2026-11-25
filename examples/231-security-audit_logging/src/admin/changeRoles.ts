export type Role = "viewer" | "editor" | "billing" | "admin";

export interface Session {
    userId: string;
    roles: Role[];
    ip: string;
}

export interface AuditEntry {
    at: string;
    actorId: string;
    action: string;
    targetId: string;
    outcome: "success" | "denied" | "error";
    ip: string;
    before?: Role[];
    after?: Role[];
    reason?: string;
}

export interface AuditLog {
    write(entry: AuditEntry): Promise<void>;
}

export interface UserRoles {
    get(userId: string): Promise<Role[] | null>;
    set(userId: string, roles: Role[]): Promise<void>;
}

// Body of PUT /admin/users/:id/roles. `actorId` is sent by the internal support console,
// which acts on behalf of the support agent who clicked the button.
export interface ChangeRolesRequest {
    targetUserId: string;
    roles: Role[];
    reason?: string;
    actorId?: string;
}

export interface Deps {
    roles: UserRoles;
    audit: AuditLog;
    now: () => Date;
}

export async function changeRoles(session: Session, req: ChangeRolesRequest, deps: Deps): Promise<{ status: number; body: unknown }> {
    const entry = {
        at: deps.now().toISOString(),
        actorId: req.actorId ?? session.userId,
        action: "user.roles.change",
        targetId: req.targetUserId,
        ip: session.ip,
        reason: req.reason,
    };

    if (!session.roles.includes("admin")) {
        await deps.audit.write({ ...entry, outcome: "denied", after: req.roles });
        return { status: 403, body: { error: "forbidden" } };
    }

    const before = await deps.roles.get(req.targetUserId);
    if (before === null) return { status: 404, body: { error: "user not found" } };

    try {
        await deps.roles.set(req.targetUserId, req.roles);
    } catch (err) {
        await deps.audit.write({ ...entry, outcome: "error", before, after: req.roles });
        throw err;
    }
    await deps.audit.write({ ...entry, outcome: "success", before, after: req.roles });
    return { status: 200, body: { roles: req.roles } };
}
