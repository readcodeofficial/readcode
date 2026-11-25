import { Mutex } from "./mutex.ts";

export interface WalletStore {
    load(id: string): Promise<number | null>; // balance in cents
    save(id: string, balanceCents: number): Promise<void>;
}

export class InsufficientFundsError extends Error {
    constructor(walletId: string) {
        super(`Wallet ${walletId} has insufficient funds`);
        this.name = "InsufficientFundsError";
    }
}

export class WalletService {
    private readonly store: WalletStore;
    private readonly locks = new Map<string, Mutex>();

    constructor(store: WalletStore) {
        this.store = store;
    }

    private lockFor(walletId: string): Mutex {
        let lock = this.locks.get(walletId);
        if (!lock) {
            lock = new Mutex();
            this.locks.set(walletId, lock);
        }
        return lock;
    }

    // Peer-to-peer transfer between two wallets.
    async transfer(fromId: string, toId: string, amountCents: number): Promise<void> {
        if (fromId === toId) throw new Error("Cannot transfer to the same wallet");
        if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error("Amount must be a positive number of cents");

        const releaseFrom = await this.lockFor(fromId).acquire();
        try {
            const fromBalance = await this.store.load(fromId);
            if (fromBalance === null) throw new Error(`Unknown wallet ${fromId}`);

            const releaseTo = await this.lockFor(toId).acquire();
            try {
                const toBalance = await this.store.load(toId);
                if (toBalance === null) throw new Error(`Unknown wallet ${toId}`);
                if (fromBalance < amountCents) throw new InsufficientFundsError(fromId);

                await this.store.save(fromId, fromBalance - amountCents);
                await this.store.save(toId, toBalance + amountCents);
            } finally {
                releaseTo();
            }
        } finally {
            releaseFrom();
        }
    }
}
