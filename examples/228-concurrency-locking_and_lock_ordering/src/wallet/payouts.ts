import { InsufficientFundsError, type WalletService } from "./wallets.ts";

export interface Payout {
    toId: string;
    amountCents: number;
}

export interface PayoutReport {
    paid: string[];
    failed: { toId: string; reason: "insufficient_funds" | "error"; message: string }[];
}

// Pays many wallets from one (e.g. a marketplace paying its sellers), a few at a time.
// Each payout succeeds or fails on its own; the report says which.
export async function payoutAll(
    wallets: Pick<WalletService, "transfer">,
    fromId: string,
    payouts: Payout[],
    concurrency = 4,
): Promise<PayoutReport> {
    const report: PayoutReport = { paid: [], failed: [] };
    let next = 0;

    async function worker(): Promise<void> {
        while (next < payouts.length) {
            const payout = payouts[next++];
            try {
                await wallets.transfer(fromId, payout.toId, payout.amountCents);
                report.paid.push(payout.toId);
            } catch (err) {
                report.failed.push({
                    toId: payout.toId,
                    reason: err instanceof InsufficientFundsError ? "insufficient_funds" : "error",
                    message: (err as Error).message,
                });
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, payouts.length) }, () => worker()));
    return report;
}
