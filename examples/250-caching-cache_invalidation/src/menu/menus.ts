import type { Cache } from "./cache.ts";

export interface MenuItem {
    id: string;
    name: string;
    priceCents: number;
    available: boolean;
}

export interface Menu {
    restaurantId: string;
    items: MenuItem[];
}

export type ItemChanges = Partial<Pick<MenuItem, "priceCents" | "available">>;

export interface MenuStore {
    loadMenu(restaurantId: string): Promise<Menu | null>;
    updateItem(restaurantId: string, itemId: string, changes: ItemChanges): Promise<boolean>; // false if no such item
}

export const MENU_TTL_MS = 10 * 60_000;
const menuKey = (restaurantId: string) => `menu:${restaurantId}`;

// Restaurant menus are read on every app open and changed a few times a day, so the whole
// menu is cached per restaurant (read-through) and dropped from the cache whenever it changes.
export class MenuService {
    private readonly store: MenuStore;
    private readonly cache: Cache<Menu>;

    constructor(store: MenuStore, cache: Cache<Menu>) {
        this.store = store;
        this.cache = cache;
    }

    async getMenu(restaurantId: string): Promise<Menu> {
        const key = menuKey(restaurantId);
        const cached = await this.cache.get(key);
        if (cached) return cached;
        const menu = await this.store.loadMenu(restaurantId);
        if (!menu) throw new Error(`Unknown restaurant ${restaurantId}`);
        await this.cache.set(key, menu, MENU_TTL_MS);
        return menu;
    }

    async updatePrice(restaurantId: string, itemId: string, priceCents: number): Promise<void> {
        if (!Number.isInteger(priceCents) || priceCents <= 0) throw new Error("Price must be a positive number of cents");
        await this.change(restaurantId, itemId, { priceCents });
    }

    async setAvailable(restaurantId: string, itemId: string, available: boolean): Promise<void> {
        await this.change(restaurantId, itemId, { available });
    }

    private async change(restaurantId: string, itemId: string, changes: ItemChanges): Promise<void> {
        await this.cache.delete(menuKey(restaurantId));
        const found = await this.store.updateItem(restaurantId, itemId, changes);
        if (!found) throw new Error(`Unknown item ${itemId} at ${restaurantId}`);
    }
}
