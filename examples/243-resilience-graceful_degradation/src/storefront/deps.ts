export interface MenuItem {
    id: string;
    name: string;
    priceCents: number;
    available: boolean;
}

export interface Menu {
    restaurantId: string;
    restaurantName: string;
    items: MenuItem[];
}

export interface Promo {
    itemId: string;
    percentOff: number;
}

export interface ReviewSummary {
    average: number | null;
    count: number;
}

// The menu is the page; everything else is nice to have.
export interface StorefrontDeps {
    menus: { getMenu(restaurantId: string): Promise<Menu | null> };
    eta: { estimateMinutes(restaurantId: string, zone: string): Promise<number> };
    promos: { active(restaurantId: string): Promise<Promo[]> };
    reviews: { summary(restaurantId: string): Promise<ReviewSummary> };
}
