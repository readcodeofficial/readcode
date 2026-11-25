import type { Response, User } from "./handlers.ts";

export interface UserQuery {
    listAll(): Promise<User[]>;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const PLANS = ["free", "pro", "team"];

type Query = Record<string, string | undefined>;

// GET /users?plan=pro&limit=20&after=<id>
// Keyset pagination by id: stable while users are added, unlike offsets.
export async function listUsers(repo: UserQuery, query: Query): Promise<Response> {
    const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        return { status: 400, body: { error: `limit must be an integer from 1 to ${MAX_LIMIT}` } };
    }
    const plan = query.plan;
    if (plan !== undefined && !PLANS.includes(plan)) {
        return { status: 400, body: { error: `plan must be one of ${PLANS.join(", ")}` } };
    }

    // ?q= matches anywhere in the name, case-insensitively
    const search = query.q?.trim().toLowerCase() || undefined;
    if (search !== undefined && search.length > 50) {
        return { status: 400, body: { error: "q must be at most 50 characters" } };
    }

    const matching = (await repo.listAll())
        .filter((u) => plan === undefined || u.plan === plan)
        .filter((u) => search === undefined || u.name.toLowerCase().includes(search))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const after = query.after;
    const rest = after === undefined ? matching : matching.filter((u) => u.id > after);
    const page = rest.slice(0, limit);

    const headers: Record<string, string> = { "X-Total-Count": String(matching.length) };
    if (rest.length > limit) {
        const next = new URLSearchParams({
            ...(plan ? { plan } : {}),
            ...(search ? { q: search } : {}),
            limit: String(limit),
            after: page[page.length - 1].id,
        });
        headers.Link = `</users?${next}>; rel="next"`;
    }
    // list items are a summary; the full representation (with email) is at /users/:id
    return { status: 200, headers, body: { items: page.map(({ id, name, plan }) => ({ id, name, plan })) } };
}
