export interface PriceSource {
    fetchPriceCents(sku: string): Promise<number>;
}

export interface PriceQuote {
    sku: string;
    priceCents: number | null; // null when the price service failed for this SKU
    error?: string;
}

// Look up the price of every SKU, at most `concurrency` requests at a time.
export async function quoteCart(skus: string[], source: PriceSource, concurrency = 4): Promise<PriceQuote[]> {
    const quotes: PriceQuote[] = [];
    let next = 0;

    async function worker(): Promise<void> {
        while (next < skus.length) {
            const sku = skus[next++];
            try {
                quotes.push({ sku, priceCents: await source.fetchPriceCents(sku) });
            } catch (err) {
                quotes.push({ sku, priceCents: null, error: (err as Error).message });
            }
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, skus.length) }, () => worker());
    await Promise.all(workers);
    return quotes;
}
