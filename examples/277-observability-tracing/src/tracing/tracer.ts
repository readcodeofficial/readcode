import { AsyncLocalStorage } from "node:async_hooks";

export interface Span {
    traceId: string;
    spanId: string;
    parentId: string | null;
    name: string;
    attributes: Record<string, string | number>;
    status: "ok" | "error";
}

// Minimal tracer: the current span follows async work through AsyncLocalStorage.
export class Tracer {
    readonly finished: Span[] = [];
    private readonly storage = new AsyncLocalStorage<Span>();
    private readonly newId: () => string;

    constructor(newId: () => string) {
        this.newId = newId;
    }

    current(): Span | undefined {
        return this.storage.getStore();
    }

    startSpan(name: string, parent: Span | undefined = this.current()): Span {
        return {
            traceId: parent?.traceId ?? this.newId(),
            spanId: this.newId(),
            parentId: parent?.spanId ?? null,
            name,
            attributes: {},
            status: "ok",
        };
    }

    end(span: Span, err?: unknown): void {
        if (err !== undefined) {
            span.status = "error";
            span.attributes.error = err instanceof Error ? err.message : String(err);
        }
        this.finished.push(span);
    }

    // Runs fn in a new span, which is the current span for everything fn does (including awaits).
    async withSpan<T>(name: string, fn: (span: Span) => Promise<T>, parent: Span | undefined = this.current()): Promise<T> {
        const span = this.startSpan(name, parent);
        try {
            const result = await this.storage.run(span, () => fn(span));
            this.end(span);
            return result;
        } catch (err) {
            this.end(span, err);
            throw err;
        }
    }

    // Parses a W3C traceparent header ("00-<traceId>-<spanId>-<flags>") from an upstream service.
    extract(header: string | undefined): Span | undefined {
        const m = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/.exec(header ?? "");
        if (!m) return undefined;
        return { traceId: m[1], spanId: m[2], parentId: null, name: "remote", attributes: {}, status: "ok" };
    }
}
