export type Level = "debug" | "info" | "warn" | "error";
export type Fields = Record<string, unknown>;

const SEVERITY: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogSink {
    write(line: string): void;
}

export interface LoggerOptions {
    level: Level;
    clock: () => Date;
    bindings?: Fields; // fields stamped on every line from this logger
}

// Errors don't JSON.stringify to anything useful ({}), so they get flattened first.
function serialize(value: unknown): unknown {
    if (value instanceof Error) return { type: value.name, message: value.message, stack: value.stack?.split("\n").slice(0, 5).join("\n") };
    return value;
}

// One JSON object per line: { time, level, msg, ...bindings, ...fields }.
export class Logger {
    private readonly sink: LogSink;
    private readonly options: LoggerOptions;
    private readonly bindings: Fields;

    constructor(sink: LogSink, options: LoggerOptions) {
        this.sink = sink;
        this.options = options;
        this.bindings = options.bindings ?? {};
    }

    // A logger for one unit of work (a request, a job) that adds its own context to every line.
    child(fields: Fields): Logger {
        const bindings = Object.assign(this.bindings, fields);
        return new Logger(this.sink, { ...this.options, bindings });
    }

    debug(msg: string, fields?: Fields): void {
        this.write("debug", msg, fields);
    }
    info(msg: string, fields?: Fields): void {
        this.write("info", msg, fields);
    }
    warn(msg: string, fields?: Fields): void {
        this.write("warn", msg, fields);
    }
    error(msg: string, fields?: Fields): void {
        this.write("error", msg, fields);
    }

    private write(level: Level, msg: string, fields: Fields = {}): void {
        if (SEVERITY[level] < SEVERITY[this.options.level]) return;
        const entry: Fields = { time: this.options.clock().toISOString(), level, msg };
        for (const [k, v] of Object.entries({ ...this.bindings, ...fields })) {
            if (v !== undefined && !(k in entry)) entry[k] = serialize(v);
        }
        this.sink.write(JSON.stringify(entry));
    }
}
