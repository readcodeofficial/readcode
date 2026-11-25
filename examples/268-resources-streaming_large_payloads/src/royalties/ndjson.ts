import { Transform, type TransformCallback } from "node:stream";

export interface ParsedLine {
    line: number;
    value: unknown;
}

// Turns a byte stream of newline-delimited JSON into one object per line.
// Distributor statements run to several GB, so lines are parsed as the bytes arrive;
// only the current partial line is kept in memory.
export class NdjsonParser extends Transform {
    private readonly maxLineLength: number;
    private carry = "";
    private lineNo = 0;

    constructor(maxLineLength = 64 * 1024) {
        super({ readableObjectMode: true });
        this.maxLineLength = maxLineLength;
    }

    _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback): void {
        const lines = (this.carry + chunk.toString("utf8")).split("\n");
        this.carry = lines.pop() ?? "";
        if (this.carry.length > this.maxLineLength) {
            done(new Error(`line ${this.lineNo + lines.length + 1}: longer than ${this.maxLineLength} characters`));
            return;
        }
        try {
            for (const line of lines) this.emitLine(line);
            done();
        } catch (err) {
            done(err as Error);
        }
    }

    _flush(done: TransformCallback): void {
        try {
            this.emitLine(this.carry);
            this.carry = "";
            done();
        } catch (err) {
            done(err as Error);
        }
    }

    private emitLine(raw: string): void {
        this.lineNo++;
        const line = raw.trim(); // also drops the \r of CRLF files
        if (line === "") return;
        let value: unknown;
        try {
            value = JSON.parse(line);
        } catch {
            throw new Error(`line ${this.lineNo}: invalid JSON`);
        }
        this.push({ line: this.lineNo, value } satisfies ParsedLine);
    }
}
