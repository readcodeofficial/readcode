import type { MenuService } from "./menus.ts";

export interface OrderLine {
    itemId: string;
    qty: number;
}

export interface Quote {
    lines: { itemId: string; qty: number; unitCents: number; totalCents: number }[];
    subtotalCents: number;
}

export class ItemUnavailableError extends Error {
    readonly itemId: string;
    constructor(itemId: string) {
        super(`Item ${itemId} is not available`);
        this.name = "ItemUnavailableError";
        this.itemId = itemId;
    }
}

// Prices an order from the restaurant's current menu, the same menu the app shows.
export async function quoteOrder(menus: Pick<MenuService, "getMenu">, restaurantId: string, lines: OrderLine[]): Promise<Quote> {
    if (lines.length === 0) throw new Error("An order needs at least one item");
    const menu = await menus.getMenu(restaurantId);
    const byId = new Map(menu.items.map((i) => [i.id, i]));

    const priced = lines.map(({ itemId, qty }) => {
        if (!Number.isInteger(qty) || qty < 1) throw new Error(`Invalid quantity for ${itemId}`);
        const item = byId.get(itemId);
        if (!item || !item.available) throw new ItemUnavailableError(itemId);
        return { itemId, qty, unitCents: item.priceCents, totalCents: item.priceCents * qty };
    });
    return { lines: priced, subtotalCents: priced.reduce((sum, l) => sum + l.totalCents, 0) };
}
