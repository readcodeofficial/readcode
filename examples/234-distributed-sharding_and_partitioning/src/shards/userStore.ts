import { ShardRouter } from "./router.ts";

export interface User {
    id: string;
    email: string;
    name: string;
}

// Stand-in for one database shard.
export interface Shard {
    name: string;
    rows: Map<string, User>;
}

export class ShardedUserStore {
    private readonly router: ShardRouter<Shard>;

    constructor(shardCount: number) {
        this.router = new ShardRouter(
            Array.from({ length: shardCount }, (_, i) => ({ name: `users-${i}`, rows: new Map<string, User>() })),
        );
    }

    async put(user: User): Promise<void> {
        this.router.shardFor(user.id).rows.set(user.id, user);
    }

    async get(id: string): Promise<User | null> {
        return this.router.shardFor(id).rows.get(id) ?? null;
    }

    // Users are partitioned by id, so a lookup by email has to ask every shard.
    async findByEmail(email: string): Promise<User | null> {
        const hits = await Promise.all(
            this.router.all().map(async (shard) => [...shard.rows.values()].find((u) => u.email === email) ?? null),
        );
        return hits.find((u) => u !== null) ?? null;
    }

    sizes(): number[] {
        return this.router.all().map((s) => s.rows.size);
    }
}
