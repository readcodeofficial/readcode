export interface Gathered<R> {
    results: R[];
    failedShards: string[]; // timed out or errored; the answer is partial when non-empty
}

// Ask every shard the same question in parallel. A slow or failing shard doesn't fail the
// whole query: its name is reported so the caller can say "results may be incomplete".
export async function scatterGather<S extends { name: string }, R>(
    shards: readonly S[],
    query: (shard: S) => Promise<R>,
    timeoutMs: number,
): Promise<Gathered<R>> {
    const settled = await Promise.all(
        shards.map(async (shard) => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            const timeout = new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`${shard.name} timed out`)), timeoutMs);
            });
            try {
                return { shard, ok: true as const, value: await Promise.race([query(shard), timeout]) };
            } catch {
                return { shard, ok: false as const };
            } finally {
                clearTimeout(timer);
            }
        }),
    );
    const gathered: Gathered<R> = { results: [], failedShards: [] };
    for (const s of settled) {
        if (s.ok) gathered.results.push(s.value);
        else gathered.failedShards.push(s.shard.name);
    }
    return gathered;
}
