import { withRetry, type RetryDeps, type RetryPolicy } from "./retry.ts";

export interface SmsMessage {
    to: string; // E.164, e.g. +14155550123
    body: string;
    idempotencyKey: string; // the gateway drops a repeat of a key it has already accepted
}

export interface SmsGateway {
    post(msg: SmsMessage): Promise<{ messageId: string }>;
}

export const DEFAULT_POLICY: RetryPolicy = { maxAttempts: 4, baseDelayMs: 500, maxDelayMs: 8000 };

export class SmsSender {
    private readonly gateway: SmsGateway;
    private readonly policy: RetryPolicy;
    private readonly deps: RetryDeps;

    constructor(gateway: SmsGateway, deps: RetryDeps, policy: RetryPolicy = DEFAULT_POLICY) {
        this.gateway = gateway;
        this.deps = deps;
        this.policy = policy;
    }

    async send(msg: SmsMessage): Promise<string> {
        if (!/^\+[1-9]\d{6,14}$/.test(msg.to)) throw new Error(`Not an E.164 number: ${msg.to}`);
        // The same message (and key) is sent on every attempt, so a retry after a lost response can't double-send.
        const res = await withRetry(this.policy, this.deps, () => this.gateway.post(msg));
        return res.messageId;
    }
}
