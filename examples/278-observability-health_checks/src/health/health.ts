export interface Check {
    name: string;
    // Critical dependencies make the instance unready when they fail; the rest only degrade it.
    critical: boolean;
    // Resolves when healthy, throws (or rejects) when not.
    run(): Promise<void>;
}

export interface CheckResult {
    name: string;
    critical: boolean;
    ok: boolean;
    error?: string;
}

export interface HealthReport {
    status: "ok" | "degraded" | "down";
    reason?: string;
    checks: CheckResult[];
}

export class HealthService {
    private readonly checks: Check[] = [];
    private readonly timeoutMs: number;
    private started = false;
    private draining = false;
    private fatal: string | null = null;

    constructor(timeoutMs = 200) {
        this.timeoutMs = timeoutMs;
    }

    register(check: Check): void {
        this.checks.push(check);
    }

    markStarted(): void {
        this.started = true;
    }

    // Shutdown has begun: stop taking new traffic, finish what's in flight.
    markDraining(): void {
        this.draining = true;
    }

    // The process is broken in a way only a restart fixes.
    markFatal(reason: string): void {
        this.fatal = reason;
    }

    // Liveness: should the orchestrator restart this process?
    async live(): Promise<HealthReport> {
        if (this.fatal) return { status: "down", reason: this.fatal, checks: [] };
        // A process that can't reach what it needs to serve requests isn't doing its job.
        const results = await this.runAll(this.checks.filter((c) => c.critical));
        return results.every((r) => r.ok) ? { status: "ok", checks: results } : { status: "down", reason: "critical dependency failing", checks: results };
    }

    // Readiness: should the load balancer send this instance traffic right now?
    async ready(): Promise<HealthReport> {
        if (this.fatal) return { status: "down", reason: this.fatal, checks: [] };
        if (!this.started) return { status: "down", reason: "starting", checks: [] };
        if (this.draining) return { status: "down", reason: "draining", checks: [] };
        const results = await this.runAll(this.checks);
        if (results.some((r) => !r.ok && r.critical)) return { status: "down", reason: "critical dependency failing", checks: results };
        return { status: results.some((r) => !r.ok) ? "degraded" : "ok", checks: results };
    }

    private runAll(checks: Check[]): Promise<CheckResult[]> {
        return Promise.all(checks.map((c) => this.runOne(c)));
    }

    private async runOne(check: Check): Promise<CheckResult> {
        let timer: NodeJS.Timeout | undefined;
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
        });
        try {
            await Promise.race([check.run(), timeout]);
            return { name: check.name, critical: check.critical, ok: true };
        } catch (err) {
            return { name: check.name, critical: check.critical, ok: false, error: (err as Error).message };
        } finally {
            clearTimeout(timer);
        }
    }
}
