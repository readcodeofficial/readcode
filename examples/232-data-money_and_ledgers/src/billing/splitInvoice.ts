import { allocate } from "./allocate.ts";

export interface LedgerEntry {
    account: string;
    debitCents: number;
    creditCents: number;
    memo: string;
}

export interface CostCenter {
    account: string; // e.g. "expense:team-search"
    seats: number;
}

// A shared SaaS invoice is paid from accounts payable and charged back to teams by seat count.
export function chargeBackInvoice(invoiceId: string, totalCents: number, centers: CostCenter[]): LedgerEntry[] {
    const shares = allocate(totalCents, centers.map((c) => c.seats));
    const entries: LedgerEntry[] = [
        { account: "liability:accounts-payable", debitCents: 0, creditCents: totalCents, memo: `invoice ${invoiceId}` },
        ...centers.map((c, i) => ({ account: c.account, debitCents: shares[i], creditCents: 0, memo: `invoice ${invoiceId}: ${c.seats} seats` })),
    ];

    const debits = entries.reduce((sum, e) => sum + e.debitCents, 0);
    const credits = entries.reduce((sum, e) => sum + e.creditCents, 0);
    if (debits !== credits) {
        throw new Error(`Unbalanced journal for invoice ${invoiceId}: debits ${debits} != credits ${credits}`);
    }
    return entries.filter((e) => e.debitCents !== 0 || e.creditCents !== 0);
}
