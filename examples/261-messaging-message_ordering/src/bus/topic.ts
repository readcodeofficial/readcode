export class TransientSendError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TransientSendError";
    }
}

// In-memory stand-in for a partitioned topic (Kafka-style). Order is guaranteed only within a
// partition, in the order the producer's sends succeeded.
export class PartitionedTopic<T> {
    readonly partitions: T[][];
    // Test hook: return an error to make the broker reject this send.
    failWhen: (partition: number, message: T) => Error | null = () => null;

    constructor(partitionCount: number) {
        this.partitions = Array.from({ length: partitionCount }, () => []);
    }

    partitionFor(key: string): number {
        let h = 0;
        for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
        return h % this.partitions.length;
    }

    async send(partition: number, message: T): Promise<void> {
        await Promise.resolve();
        const err = this.failWhen(partition, message);
        if (err) throw err;
        this.partitions[partition].push(message);
    }

    // A consumer reads each partition from `from` onward.
    read(partition: number, from: number): T[] {
        return this.partitions[partition].slice(from);
    }
}
