// Deterministic clock for tests: time only moves when advance() is called.
export class FakeClock {
    #now;
    #timers = [];
    #nextId = 1;

    constructor(start = 0) {
        this.#now = start;
    }

    now() {
        return this.#now;
    }

    setTimeout(fn, ms) {
        const id = this.#nextId++;
        this.#timers.push({ id, at: this.#now + ms, fn });
        return id;
    }

    clearTimeout(id) {
        this.#timers = this.#timers.filter((t) => t.id !== id);
    }

    pending() {
        return this.#timers.length;
    }

    advance(ms) {
        const target = this.#now + ms;
        this.#now = target;
        for (const timer of [...this.#timers]) {
            if (timer.at <= target && this.#timers.includes(timer)) {
                this.clearTimeout(timer.id);
                timer.fn();
            }
        }
    }
}

export const realClock = {
    now: () => Date.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
};
