export interface Connection {
    query(sql: string, params?: unknown[]): Promise<void>;
}

// Fixed-size database connection pool. When every connection is checked out,
// acquire() waits until one is released.
export class ConnectionPool {
    private readonly connect: () => Connection;
    private readonly size: number;
    private readonly idle: Connection[] = [];
    private readonly waiters: ((conn: Connection) => void)[] = [];
    private opened = 0;

    constructor(connect: () => Connection, size: number) {
        if (!Number.isInteger(size) || size < 1) throw new Error("Pool size must be a positive integer");
        this.connect = connect;
        this.size = size;
    }

    async acquire(): Promise<Connection> {
        const conn = this.idle.pop();
        if (conn) return conn;
        if (this.opened < this.size) {
            this.opened++;
            return this.connect();
        }
        return new Promise((resolve) => this.waiters.push(resolve));
    }

    release(conn: Connection): void {
        const next = this.waiters.shift();
        if (next) next(conn);
        else this.idle.push(conn);
    }

    async withConnection<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
        const conn = await this.acquire();
        try {
            return await fn(conn);
        } finally {
            this.release(conn);
        }
    }

    stats() {
        return { size: this.size, inUse: this.opened - this.idle.length, waiting: this.waiters.length };
    }
}
