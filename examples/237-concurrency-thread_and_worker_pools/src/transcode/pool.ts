// Runs at most `size` tasks at a time; the rest wait in FIFO order.
// Encoders are CPU- and memory-heavy, so each worker host gets one pool sized to its cores.
export class WorkerPool {
    private readonly size: number;
    private active = 0;
    private readonly queue: (() => void)[] = [];
    private readonly idleWaiters: (() => void)[] = [];

    constructor(size: number) {
        if (!Number.isInteger(size) || size < 1) throw new Error("Pool size must be a positive integer");
        this.size = size;
    }

    submit<T>(task: () => Promise<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const run = () => {
                this.active++;
                task().then(
                    (value) => {
                        this.active--;
                        this.startNext();
                        resolve(value);
                    },
                    reject,
                );
            };
            if (this.active < this.size) run();
            else this.queue.push(run);
        });
    }

    private startNext(): void {
        const next = this.queue.shift();
        if (next) next();
        else if (this.active === 0) for (const wake of this.idleWaiters.splice(0)) wake();
    }

    // Resolves when nothing is running or queued (used before a host scales down).
    onIdle(): Promise<void> {
        if (this.active === 0 && this.queue.length === 0) return Promise.resolve();
        return new Promise((resolve) => this.idleWaiters.push(resolve));
    }

    stats() {
        return { size: this.size, active: this.active, queued: this.queue.length };
    }
}
