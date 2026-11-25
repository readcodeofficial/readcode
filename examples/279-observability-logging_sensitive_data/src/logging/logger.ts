import { redact, redactText } from "./redact.ts";

export type Level = "debug" | "info" | "warn" | "error";

export interface LogSink {
    write(line: string): void;
}

// JSON-lines logger. Every field goes through redact() before it is written.
export class Logger {
    private readonly sink: LogSink;
    private readonly now: () => Date;
    private readonly base: Record<string, unknown>;

    constructor(sink: LogSink, now: () => Date, base: Record<string, unknown> = {}) {
        this.sink = sink;
        this.now = now;
        this.base = base;
    }

    child(fields: Record<string, unknown>): Logger {
        return new Logger(this.sink, this.now, { ...this.base, ...fields });
    }

    info(msg: string, fields: Record<string, unknown> = {}): void {
        this.log("info", msg, fields);
    }

    warn(msg: string, fields: Record<string, unknown> = {}): void {
        this.log("warn", msg, fields);
    }

    error(msg: string, fields: Record<string, unknown> = {}): void {
        this.log("error", msg, fields);
    }

    private log(level: Level, msg: string, fields: Record<string, unknown>): void {
        const entry = { ts: this.now().toISOString(), level, msg: redactText(msg), ...(redact({ ...this.base, ...fields }) as object) };
        this.sink.write(JSON.stringify(entry));
    }
}
