export interface Connection {
    query<T>(sql: string, params: unknown[]): Promise<T[]>;
}

// Fixed-size connection pool, like the one in front of our Postgres. When every connection is
// checked out, acquire() waits (first come, first served) until one is released.
export class Pool {
    private readonly idle: Connection[] = [];
    private readonly waiters: ((conn: Connection) => void)[] = [];
    private checkedOut = 0;
    maxCheckedOut = 0;

    constructor(size: number, connect: () => Connection) {
        for (let i = 0; i < size; i++) this.idle.push(connect());
    }

    get inUse(): number {
        return this.checkedOut;
    }

    acquire(): Promise<Connection> {
        const conn = this.idle.pop();
        if (conn) {
            this.checkedOut++;
            this.maxCheckedOut = Math.max(this.maxCheckedOut, this.checkedOut);
            return Promise.resolve(conn);
        }
        return new Promise((resolve) => this.waiters.push(resolve));
    }

    release(conn: Connection): void {
        const next = this.waiters.shift();
        if (next) next(conn); // handed straight to the next caller; still checked out
        else {
            this.checkedOut--;
            this.idle.push(conn);
        }
    }

    async withConnection<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
        const conn = await this.acquire();
        try {
            return await fn(conn);
        } finally {
            this.release(conn);
        }
    }
}
