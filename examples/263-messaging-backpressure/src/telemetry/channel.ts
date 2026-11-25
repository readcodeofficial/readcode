export class ChannelClosedError extends Error {
    constructor() {
        super("channel is closed");
        this.name = "ChannelClosedError";
    }
}

interface ParkedSender<T> {
    item: T;
    resolve: () => void;
}

// Bounded in-memory channel between the device listeners and the storage writer.
// send() resolves once the item is in the buffer; while the buffer is full the sender is parked.
// receive() waits while the channel is empty.
export class BoundedChannel<T> {
    private readonly capacity: number;
    private readonly buffer: T[] = [];
    private readonly parked: ParkedSender<T>[] = [];
    private readonly waitingReceivers: ((result: IteratorResult<T, undefined>) => void)[] = [];
    private closed = false;
    // Most items held at once, buffered plus parked. Exported as the gateway's memory gauge.
    highWater = 0;

    constructor(capacity: number) {
        if (!Number.isInteger(capacity) || capacity < 1) throw new Error("capacity must be a positive integer");
        this.capacity = capacity;
    }

    send(item: T): Promise<void> {
        if (this.closed) return Promise.reject(new ChannelClosedError());
        const receiver = this.waitingReceivers.shift();
        if (receiver) {
            receiver({ value: item, done: false });
            return Promise.resolve();
        }
        if (this.buffer.length < this.capacity) {
            this.buffer.push(item);
            this.track();
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.parked.push({ item, resolve });
            this.track();
        });
    }

    receive(): Promise<IteratorResult<T, undefined>> {
        if (this.buffer.length > 0) {
            const item = this.buffer.shift() as T;
            const sender = this.parked.shift();
            if (sender) {
                this.buffer.push(sender.item);
                sender.resolve();
            }
            return Promise.resolve({ value: item, done: false });
        }
        if (this.closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => this.waitingReceivers.push(resolve));
    }

    // No more sends; receivers drain what is left and then see the end.
    close(): void {
        this.closed = true;
        for (const receiver of this.waitingReceivers.splice(0)) receiver({ value: undefined, done: true });
    }

    [Symbol.asyncIterator](): AsyncIterator<T, undefined> {
        return { next: () => this.receive() };
    }

    private track(): void {
        this.highWater = Math.max(this.highWater, this.buffer.length + this.parked.length);
    }
}
