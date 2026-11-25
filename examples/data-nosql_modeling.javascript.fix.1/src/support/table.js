// In-memory stand-in for a single-table wide-column store (DynamoDB style):
// items live under a partition key (pk) and are ordered by sort key (sk) as plain strings.
export function createTable() {
    const partitions = new Map();

    const partition = (pk) => {
        if (!partitions.has(pk)) partitions.set(pk, new Map());
        return partitions.get(pk);
    };

    return {
        put(item) {
            partition(item.pk).set(item.sk, structuredClone(item));
        },

        get(pk, sk) {
            const item = partitions.get(pk)?.get(sk);
            return item ? structuredClone(item) : null;
        },

        increment(pk, sk, attr) {
            const part = partition(pk);
            const item = part.get(sk) ?? { pk, sk };
            item[attr] = (item[attr] ?? 0) + 1;
            part.set(sk, item);
            return item[attr];
        },

        // Items with this pk whose sk satisfies the condition, in sort key order.
        query(pk, { skPrefix, skBetween, limit, newestFirst = false, startAfter } = {}) {
            let items = [...(partitions.get(pk)?.values() ?? [])];
            if (skPrefix !== undefined) items = items.filter((i) => i.sk.startsWith(skPrefix));
            if (skBetween) items = items.filter((i) => i.sk >= skBetween[0] && i.sk <= skBetween[1]);
            items.sort((a, b) => (a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0));
            if (newestFirst) items.reverse();
            if (startAfter !== undefined) {
                const idx = items.findIndex((i) => i.sk === startAfter);
                items = items.slice(idx + 1);
            }
            const page = limit === undefined ? items : items.slice(0, limit);
            return {
                items: page.map((i) => structuredClone(i)),
                lastKey: limit !== undefined && items.length > limit ? page[page.length - 1].sk : null,
            };
        },
    };
}
