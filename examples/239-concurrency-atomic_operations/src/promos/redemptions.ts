import { checkEligibility, discountFor, type CampaignCatalog, type Rejection } from "./campaigns.ts";
import type { KeyValueStore } from "./kv.ts";

export type RedeemResult = { ok: true; code: string; discountCents: number } | { ok: false; reason: Rejection };

const countKey = (code: string) => `promo:${code}:redemptions`;
const customerKey = (code: string, customerId: string) => `promo:${code}:customer:${customerId}`;

// Promo codes are redeemed from every checkout server at once, so all usage state lives in the shared store.
export class PromoRedeemer {
    private readonly catalog: CampaignCatalog;
    private readonly kv: KeyValueStore;

    constructor(catalog: CampaignCatalog, kv: KeyValueStore) {
        this.catalog = catalog;
        this.kv = kv;
    }

    async redeem(rawCode: string, customerId: string, orderId: string, orderCents: number, now: Date): Promise<RedeemResult> {
        const campaign = this.catalog.find(rawCode);
        const rejection = checkEligibility(campaign, orderCents, now);
        if (rejection || !campaign) return { ok: false, reason: rejection ?? "unknown_code" };
        const code = campaign.code;

        // One use per customer.
        if (!(await this.kv.setIfAbsent(customerKey(code, customerId), orderId))) return { ok: false, reason: "already_used" };

        const used = Number((await this.kv.get(countKey(code))) ?? "0");
        if (used >= campaign.maxRedemptions) {
            await this.kv.del(customerKey(code, customerId));
            return { ok: false, reason: "sold_out" };
        }
        await this.kv.set(countKey(code), String(used + 1));

        return { ok: true, code, discountCents: discountFor(campaign, orderCents) };
    }

    // Order cancelled before dispatch: give the redemption back to the pool and to the customer.
    async release(code: string, customerId: string, orderId: string): Promise<void> {
        if ((await this.kv.get(customerKey(code, customerId))) !== orderId) return;
        await this.kv.del(customerKey(code, customerId));
        await this.kv.incrBy(countKey(code), -1);
    }

    async redemptions(code: string): Promise<number> {
        return Number((await this.kv.get(countKey(code))) ?? "0");
    }
}
