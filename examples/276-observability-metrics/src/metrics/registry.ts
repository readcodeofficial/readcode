import type { Histogram, HistogramSnapshot } from "./histogram.ts";

// Monotonic counter with one label, e.g. bids_total{outcome="won"}.
export class Counter {
    readonly name: string;
    readonly help: string;
    readonly label: string;
    private readonly values = new Map<string, number>();

    constructor(name: string, help: string, label: string) {
        this.name = name;
        this.help = help;
        this.label = label;
    }

    inc(labelValue: string, by = 1): void {
        if (by < 0) throw new Error("counters only go up");
        this.values.set(labelValue, (this.values.get(labelValue) ?? 0) + by);
    }

    get(labelValue: string): number {
        return this.values.get(labelValue) ?? 0;
    }

    entries(): [string, number][] {
        return [...this.values.entries()].sort(([a], [b]) => a.localeCompare(b));
    }
}

const fmtLe = (le: number) => (le === Infinity ? "+Inf" : String(le));

// Renders the Prometheus text format served at GET /metrics.
export function renderMetrics(counters: Counter[], histograms: Histogram[]): string {
    const out: string[] = [];
    for (const c of counters) {
        out.push(`# HELP ${c.name} ${c.help}`, `# TYPE ${c.name} counter`);
        for (const [value, n] of c.entries()) out.push(`${c.name}{${c.label}="${value}"} ${n}`);
    }
    for (const h of histograms) {
        const snap: HistogramSnapshot = h.snapshot();
        out.push(`# HELP ${h.name} ${h.help}`, `# TYPE ${h.name} histogram`);
        for (const b of snap.buckets) out.push(`${h.name}_bucket{le="${fmtLe(b.le)}"} ${b.count}`);
        out.push(`${h.name}_sum ${snap.sum}`, `${h.name}_count ${snap.count}`);
    }
    return out.join("\n") + "\n";
}

// Share of observations at or under `threshold`, which must be one of the bucket bounds.
export function fractionWithin(snap: HistogramSnapshot, threshold: number): number {
    const bucket = snap.buckets.find((b) => b.le === threshold);
    if (!bucket) throw new Error(`no bucket with le=${threshold}`);
    return snap.count === 0 ? 1 : bucket.count / snap.count;
}
