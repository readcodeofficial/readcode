export type ServiceLevel = "ground" | "express" | "overnight";

export interface RateQuote {
    serviceLevel: ServiceLevel;
    priceCents: number;
    currency: string;
    transitDays: number;
}

interface SwiftShipRate {
    service_code: string;
    total_charge: string; // e.g. "12.40"
    currency: string;
    transit_days: number | null;
}

const SERVICE_BY_CODE: Record<string, ServiceLevel> = {
    SSG: "ground",
    SSX: "express",
    SSO: "overnight",
};

// SwiftShip sends money as a string with exactly two decimals. Parse it without floating point.
export function parseMoney(amount: string): number {
    if (!/^\d+\.\d{2}$/.test(amount)) throw new Error(`Unexpected SwiftShip amount: ${amount}`);
    const [whole, fraction] = amount.split(".");
    return Number(whole) * 100 + Number(fraction);
}

export function parseRates(body: unknown): RateQuote[] {
    const rates = (body as { rates?: SwiftShipRate[] }).rates ?? [];
    const quotes: RateQuote[] = [];
    for (const rate of rates) {
        const serviceLevel = SERVICE_BY_CODE[rate.service_code];
        // services we don't sell, or quotes without a transit estimate, can't be offered at checkout
        if (!serviceLevel || rate.transit_days === null) continue;
        quotes.push({ serviceLevel, priceCents: parseMoney(rate.total_charge), currency: rate.currency, transitDays: rate.transit_days });
    }
    return quotes;
}

// Cheapest quote that arrives within maxTransitDays; ties go to the faster service.
export function cheapestWithin(quotes: RateQuote[], maxTransitDays: number): RateQuote | null {
    let best: RateQuote | null = null;
    for (const quote of quotes) {
        if (quote.transitDays > maxTransitDays) continue;
        if (!best || quote.priceCents < best.priceCents || (quote.priceCents === best.priceCents && quote.transitDays < best.transitDays)) {
            best = quote;
        }
    }
    return best;
}
