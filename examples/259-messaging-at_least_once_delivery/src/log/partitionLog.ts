export interface LogRecord {
    offset: number;
    value: string;
}

// In-memory stand-in for one partition of a Kafka-style log. Records are never removed;
// each consumer group just remembers the offset of the next record it wants.
export class PartitionLog {
    private readonly records: string[] = [];
    private readonly commits = new Map<string, number>();

    append(value: string): number {
        this.records.push(value);
        return this.records.length - 1;
    }

    async read(fromOffset: number, max: number): Promise<LogRecord[]> {
        return this.records.slice(fromOffset, fromOffset + max).map((value, i) => ({ offset: fromOffset + i, value }));
    }

    async commit(group: string, nextOffset: number): Promise<void> {
        this.commits.set(group, nextOffset);
    }

    async committed(group: string): Promise<number> {
        return this.commits.get(group) ?? 0;
    }

    endOffset(): number {
        return this.records.length;
    }
}
