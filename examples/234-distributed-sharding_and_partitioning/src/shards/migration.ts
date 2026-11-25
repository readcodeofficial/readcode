import { ShardRouter } from "./router.ts";

export interface Move {
    key: string;
    from: number;
    to: number;
}

export interface MigrationPlan {
    moves: Move[];
    staying: number;
    // keys arriving at each new shard, to size the copy jobs
    incomingByShard: number[];
}

// Growing from `fromCount` to `toCount` shards: which keys must be copied where.
// Run before switching the router over; keys that stay put need no copy.
export function planMigration(keys: Iterable<string>, fromCount: number, toCount: number): MigrationPlan {
    if (toCount < 1 || fromCount < 1) throw new Error("shard counts must be at least 1");
    const before = new ShardRouter(Array.from({ length: fromCount }, (_, i) => i));
    const after = new ShardRouter(Array.from({ length: toCount }, (_, i) => i));

    const plan: MigrationPlan = { moves: [], staying: 0, incomingByShard: Array(toCount).fill(0) };
    for (const key of keys) {
        const from = before.shardFor(key);
        const to = after.shardFor(key);
        if (from === to) {
            plan.staying++;
            continue;
        }
        plan.moves.push({ key, from, to });
        plan.incomingByShard[to]++;
    }
    return plan;
}

// Batches of moves per (from, to) pair, so each copy job reads from one shard and writes to one.
export function batchMoves(moves: Move[], batchSize: number): Move[][] {
    const byPair = new Map<string, Move[]>();
    for (const move of moves) {
        const pair = `${move.from}->${move.to}`;
        if (!byPair.has(pair)) byPair.set(pair, []);
        byPair.get(pair)!.push(move);
    }
    const batches: Move[][] = [];
    for (const group of byPair.values()) {
        for (let i = 0; i < group.length; i += batchSize) batches.push(group.slice(i, i + batchSize));
    }
    return batches;
}
