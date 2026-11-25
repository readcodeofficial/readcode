import { PLAN_LIMITS, type Plan } from "../limits/plans.ts";
import { TokenBucketLimiter, type Clock } from "../limits/tokenBucket.ts";
import { countSegments } from "./segments.ts";

export interface Account {
    id: string;
    plan: Plan;
}

export interface SendRequest {
    apiKey: string | undefined;
    body: { to?: unknown; text?: unknown };
}

export interface SendResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}

export interface Outbox {
    enqueue(accountId: string, to: string, text: string, segments: number): Promise<string>;
}

const MAX_SEGMENTS = 10;

// POST /v1/messages
export function makeSendHandler(accounts: Map<string, Account>, outbox: Outbox, clock: Clock) {
    const limiters = new Map<Plan, TokenBucketLimiter>();
    for (const plan of Object.keys(PLAN_LIMITS) as Plan[]) {
        const { burst, perSecond } = PLAN_LIMITS[plan];
        limiters.set(plan, new TokenBucketLimiter(burst, perSecond, clock));
    }

    return async function send(req: SendRequest): Promise<SendResponse> {
        const account = req.apiKey ? accounts.get(req.apiKey) : undefined;
        if (!account) return { status: 401, headers: {}, body: { error: "invalid API key" } };

        const { to, text } = req.body;
        if (typeof to !== "string" || !/^\+[1-9]\d{6,14}$/.test(to)) {
            return { status: 400, headers: {}, body: { error: "to must be an E.164 phone number" } };
        }
        if (typeof text !== "string" || text.length === 0) {
            return { status: 400, headers: {}, body: { error: "text must be a non-empty string" } };
        }
        const segments = countSegments(text);
        if (segments > MAX_SEGMENTS) {
            return { status: 400, headers: {}, body: { error: `message is ${segments} segments; the limit is ${MAX_SEGMENTS}` } };
        }

        const decision = limiters.get(account.plan)!.take(account.id, segments);
        if (!decision.allowed) {
            return {
                status: 429,
                headers: { "Retry-After": String(Math.ceil(decision.retryAfterMs / 1000)), "X-RateLimit-Remaining": "0" },
                body: { error: "rate limit exceeded" },
            };
        }
        const id = await outbox.enqueue(account.id, to, text, segments);
        return { status: 202, headers: { "X-RateLimit-Remaining": String(decision.remaining) }, body: { id, segments } };
    };
}
