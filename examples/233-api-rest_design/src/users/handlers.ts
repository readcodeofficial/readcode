import { parseUserFields, type UserFields } from "./validate.ts";

export interface User extends UserFields {
    id: string;
    version: number;
    updatedAt: string;
}

export interface Request {
    params: { id: string };
    headers: Record<string, string | undefined>;
    body: unknown;
}

export interface Response {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
}

export interface UserRepo {
    get(id: string): Promise<User | null>;
    save(user: User): Promise<void>;
}

const etag = (u: User) => `"${u.version}"`;
const ok = (status: number, user: User, extra: Record<string, string> = {}): Response => ({
    status,
    headers: { ETag: etag(user), ...extra },
    body: user,
});
const problem = (status: number, error: string): Response => ({ status, body: { error } });

const NEW_USER_DEFAULTS: UserFields = { name: "", email: "", plan: "free" };

export function userHandlers(repo: UserRepo, now: () => Date) {
    // If-Match lets a client say "only apply this if nobody changed the user since I read it".
    function preconditionFailed(req: Request, current: User | null): boolean {
        const ifMatch = req.headers["if-match"];
        return ifMatch !== undefined && (current === null || ifMatch !== etag(current));
    }

    return {
        // GET /users/:id
        async get(req: Request): Promise<Response> {
            const user = await repo.get(req.params.id);
            return user ? ok(200, user) : problem(404, "user not found");
        },

        // PUT /users/:id: full replacement; creates the user if it doesn't exist.
        async put(req: Request): Promise<Response> {
            const parsed = parseUserFields(req.body, false);
            if (!parsed.ok) return problem(400, parsed.error);
            const current = await repo.get(req.params.id);
            if (preconditionFailed(req, current)) return problem(412, "user was modified");

            const user: User = { ...parsed.value, id: req.params.id, version: (current?.version ?? 0) + 1, updatedAt: now().toISOString() };
            await repo.save(user);
            return current ? ok(200, user) : ok(201, user, { Location: `/users/${user.id}` });
        },

        // PATCH /users/:id: change only the fields that are sent.
        async patch(req: Request): Promise<Response> {
            const parsed = parseUserFields(req.body, true);
            if (!parsed.ok) return problem(400, parsed.error);
            const current = await repo.get(req.params.id);
            if (!current) return problem(404, "user not found");
            if (preconditionFailed(req, current)) return problem(412, "user was modified");

            const user: User = {
                ...NEW_USER_DEFAULTS,
                ...parsed.value,
                id: current.id,
                version: current.version + 1,
                updatedAt: now().toISOString(),
            };
            await repo.save(user);
            return ok(200, user);
        },
    };
}
