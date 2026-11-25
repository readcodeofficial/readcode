export interface Click {
    clickId: string;
    campaignId: string;
    advertiserId: string;
    costMicros: number; // 1_000_000 micros = 1 unit of the advertiser's currency
}

export class InvalidClickError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidClickError";
    }
}

export function parseClick(value: string): Click {
    let raw: Record<string, unknown>;
    try {
        raw = JSON.parse(value);
    } catch {
        throw new InvalidClickError("not JSON");
    }
    for (const f of ["clickId", "campaignId", "advertiserId"]) {
        if (typeof raw[f] !== "string" || raw[f] === "") throw new InvalidClickError(`${f} missing`);
    }
    if (!Number.isInteger(raw.costMicros) || (raw.costMicros as number) < 0) throw new InvalidClickError("bad costMicros");
    return raw as unknown as Click;
}

export interface LedgerStore {
    // Upsert keyed by clickId; may throw on transient database errors.
    upsertCharge(click: Click): Promise<void>;
}

// What advertisers are invoiced from. Charges are keyed by clickId, so recording a click
// that was already recorded changes nothing.
export class BillingLedger implements LedgerStore {
    private readonly charges = new Map<string, Click>();

    async upsertCharge(click: Click): Promise<void> {
        this.charges.set(click.clickId, click);
    }

    totalMicros(advertiserId: string): number {
        let sum = 0;
        for (const c of this.charges.values()) if (c.advertiserId === advertiserId) sum += c.costMicros;
        return sum;
    }

    count(): number {
        return this.charges.size;
    }
}
