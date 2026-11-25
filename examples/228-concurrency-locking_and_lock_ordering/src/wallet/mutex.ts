// Async mutex: callers get the lock in the order they asked for it.
export class Mutex {
    private tail: Promise<void> = Promise.resolve();

    async acquire(): Promise<() => void> {
        let release!: () => void;
        const released = new Promise<void>((resolve) => (release = resolve));
        const previous = this.tail;
        this.tail = previous.then(() => released);
        await previous;
        return release;
    }
}
