// A tiny in-memory stand-in for a wide-column / key-value table (DynamoDB-style):
// every item lives under a partition key (pk) and is ordered within it by a sort key (sk).
export interface Item {
    pk: string;
    sk: string;
    [attr: string]: unknown;
}

export interface QueryOptions {
    beginsWith?: string;
    between?: [string, string]; // inclusive, compared as strings
    limit?: number;
}

export class Table {
    private readonly partitions = new Map<string, Map<string, Item>>();

    // Upsert: an item with the same pk + sk replaces the old one, like PutItem.
    async put(item: Item): Promise<void> {
        let partition = this.partitions.get(item.pk);
        if (!partition) {
            partition = new Map();
            this.partitions.set(item.pk, partition);
        }
        partition.set(item.sk, structuredClone(item));
    }

    async get(pk: string, sk: string): Promise<Item | null> {
        const item = this.partitions.get(pk)?.get(sk);
        return item ? structuredClone(item) : null;
    }

    async delete(pk: string, sk: string): Promise<void> {
        this.partitions.get(pk)?.delete(sk);
    }

    async query(pk: string, opts: QueryOptions = {}): Promise<Item[]> {
        const partition = this.partitions.get(pk);
        if (!partition) return [];
        const rows = [...partition.values()]
            .filter((i) => opts.beginsWith === undefined || i.sk.startsWith(opts.beginsWith))
            .filter((i) => opts.between === undefined || (i.sk >= opts.between[0] && i.sk <= opts.between[1]))
            .sort((a, b) => (a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0));
        return rows.slice(0, opts.limit ?? rows.length).map((i) => structuredClone(i));
    }
}
