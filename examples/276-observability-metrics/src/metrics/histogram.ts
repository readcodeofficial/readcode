export interface Bucket {
    le: number; // upper bound, Infinity for the last bucket
    count: number; // observations <= le (cumulative, as Prometheus expects)
}

export interface HistogramSnapshot {
    buckets: Bucket[];
    sum: number;
    count: number;
}

// Fixed-bucket histogram, e.g. for request latency in milliseconds.
export class Histogram {
    readonly name: string;
    readonly help: string;
    private readonly bounds: number[];
    private readonly perBucket: number[]; // observations that landed in each bucket; last slot is overflow
    private sum = 0;
    private count = 0;

    constructor(name: string, help: string, bounds: number[]) {
        if (bounds.length === 0) throw new Error(`${name}: needs at least one bucket`);
        for (let i = 1; i < bounds.length; i++) {
            if (!(bounds[i] > bounds[i - 1])) throw new Error(`${name}: bucket bounds must be strictly increasing`);
        }
        this.name = name;
        this.help = help;
        this.bounds = [...bounds];
        this.perBucket = new Array(bounds.length + 1).fill(0);
    }

    observe(value: number): void {
        if (!Number.isFinite(value) || value < 0) return;
        let i = this.bounds.findIndex((b) => value <= b);
        if (i === -1) i = this.bounds.length;
        this.perBucket[i]++;
        this.sum += value;
        this.count++;
    }

    snapshot(): HistogramSnapshot {
        const buckets = this.perBucket.map((n, i) => ({
            le: i < this.bounds.length ? this.bounds[i] : Infinity,
            count: n,
        }));
        return { buckets, sum: this.sum, count: this.count };
    }
}
