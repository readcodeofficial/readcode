export interface Reading {
    deviceId: string;
    metric: string;
    value: number;
    at: string; // ISO timestamp from the device
}

export interface TimeseriesSink {
    write(batch: Reading[]): Promise<void>;
    close(): Promise<void>;
}

// Buffers readings and writes them to the time-series store in batches. A batch is written as
// soon as it is full; flush() writes whatever is left.
export class Batcher {
    private readonly sink: TimeseriesSink;
    private readonly maxBatch: number;
    private buffer: Reading[] = [];
    private writing: Promise<void> = Promise.resolve();

    constructor(sink: TimeseriesSink, maxBatch = 100) {
        this.sink = sink;
        this.maxBatch = maxBatch;
    }

    get pending(): number {
        return this.buffer.length;
    }

    add(readings: Reading[]): void {
        this.buffer.push(...readings);
        while (this.buffer.length >= this.maxBatch) this.writeOut(this.buffer.splice(0, this.maxBatch));
    }

    async flush(): Promise<void> {
        if (this.buffer.length > 0) this.writeOut(this.buffer.splice(0));
        await this.writing;
    }

    // Writes are chained so batches reach the sink in order.
    private writeOut(batch: Reading[]): void {
        this.writing = this.writing.then(() => this.sink.write(batch));
    }
}
