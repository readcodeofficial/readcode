// Caps how many searches fan out to suppliers at once; the rest wait in arrival order.
// Supplier contracts limit our concurrent requests, and each search costs quota.
export class Limiter {
    private readonly max: number;
    private active = 0;
    private readonly waiting: (() => void)[] = [];

    constructor(max: number) {
        this.max = max;
    }

    async acquire(): Promise<() => void> {
        if (this.active < this.max) this.active++;
        else await new Promise<void>((resolve) => this.waiting.push(resolve));

        let released = false;
        return () => {
            if (released) return;
            released = true;
            const next = this.waiting.shift();
            if (next) next(); // hand the slot straight to the next search
            else this.active--;
        };
    }

    get queued(): number {
        return this.waiting.length;
    }
}
