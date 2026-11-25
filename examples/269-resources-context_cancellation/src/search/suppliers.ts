export interface FlightQuery {
    from: string; // IATA airport code
    to: string;
    date: string; // YYYY-MM-DD
    passengers: number;
}

export interface SupplierOffer {
    flightNumber: string;
    departs: string;
    price: number; // total, in the supplier's currency
    currency: string;
}

// A flight supplier's search API. Implementations must stop work and reject with signal.reason
// when the signal aborts; every request they send costs quota on the supplier contract.
export interface Supplier {
    name: string;
    search(query: FlightQuery, signal: AbortSignal): Promise<SupplierOffer[]>;
}

export interface Offer {
    supplier: string;
    flightNumber: string;
    departs: string;
    priceCents: number; // EUR
}

const EUR_PER_UNIT: Record<string, number> = { EUR: 1, USD: 0.92, GBP: 1.17 };

// Converts to EUR cents and drops offers we can't price.
export function normalizeOffers(supplier: string, offers: SupplierOffer[]): Offer[] {
    return offers.flatMap((o) => {
        const rate = EUR_PER_UNIT[o.currency];
        if (rate === undefined || !(o.price > 0)) return [];
        return [{ supplier, flightNumber: o.flightNumber, departs: o.departs, priceCents: Math.round(o.price * rate * 100) }];
    });
}
