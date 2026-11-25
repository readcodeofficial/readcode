import type { StorefrontDeps, Promo, ReviewSummary } from "./deps.ts";
import { withFallback } from "./fallback.ts";
import { TtlCache } from "./ttlCache.ts";

export interface PageItem {
    id: string;
    name: string;
    priceCents: number;
    salePriceCents: number | null;
}

export interface RestaurantPage {
    restaurantId: string;
    name: string;
    items: PageItem[];
    etaMinutes: number | null;
    reviews: ReviewSummary;
    degraded: string[]; // optional sections that couldn't be loaded for this response
}

export interface PageResponse {
    status: number;
    headers: Record<string, string>;
    body: RestaurantPage | { error: string };
}

const PAGE_TTL_MS = 60_000;
const NO_REVIEWS: ReviewSummary = { average: null, count: 0 };

const cacheControl = (page: RestaurantPage) => (page.degraded.length > 0 ? "no-store" : "public, max-age=60");

// GET /restaurants/:id?zone=... — the storefront page a customer sees before ordering.
export class RestaurantPageService {
    private readonly deps: StorefrontDeps;
    private readonly cache: TtlCache<RestaurantPage>;
    private readonly optionalTimeoutMs: number;

    constructor(deps: StorefrontDeps, now: () => number, optionalTimeoutMs = 250) {
        this.deps = deps;
        this.cache = new TtlCache(now);
        this.optionalTimeoutMs = optionalTimeoutMs;
    }

    async render(restaurantId: string, zone: string): Promise<PageResponse> {
        const key = `${restaurantId}:${zone}`;
        const cached = this.cache.get(key);
        if (cached) return { status: 200, headers: { "X-Cache": "hit", "Cache-Control": cacheControl(cached) }, body: cached };

        let menu;
        try {
            menu = await this.deps.menus.getMenu(restaurantId);
        } catch {
            return { status: 503, headers: { "Retry-After": "5" }, body: { error: "menu temporarily unavailable" } };
        }
        if (!menu) return { status: 404, headers: {}, body: { error: "restaurant not found" } };

        const degraded: string[] = [];
        const t = this.optionalTimeoutMs;
        const [etaMinutes, promos, reviews] = await Promise.all([
            withFallback<number | null>("eta", () => this.deps.eta.estimateMinutes(restaurantId, zone), null, t, degraded),
            withFallback<Promo[]>("promos", () => this.deps.promos.active(restaurantId), [], t, degraded),
            withFallback("reviews", () => this.deps.reviews.summary(restaurantId), NO_REVIEWS, t, degraded),
        ]);

        const discount = new Map(promos.map((p) => [p.itemId, p.percentOff]));
        const page: RestaurantPage = {
            restaurantId,
            name: menu.restaurantName,
            items: menu.items
                .filter((item) => item.available)
                .map((item) => {
                    const off = discount.get(item.id);
                    const salePriceCents = off === undefined ? null : Math.round(item.priceCents * (1 - off / 100));
                    return { id: item.id, name: item.name, priceCents: item.priceCents, salePriceCents };
                }),
            etaMinutes,
            reviews,
            degraded: degraded.sort(),
        };
        this.cache.set(key, page, PAGE_TTL_MS);
        return { status: 200, headers: { "X-Cache": "miss", "Cache-Control": cacheControl(page) }, body: page };
    }
}
