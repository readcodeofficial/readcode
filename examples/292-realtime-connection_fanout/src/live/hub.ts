import { CLOSE_TRY_AGAIN_LATER, type Connection } from "./connection.ts";

export interface HubOptions {
    // A client this far behind is disconnected rather than buffered without bound;
    // it reconnects and fetches the current state over HTTP.
    maxBufferedBytes: number;
}

// Rooms of live connections; one room per auction lot.
export class Hub {
    private readonly rooms = new Map<string, Connection[]>();
    private readonly maxBufferedBytes: number;

    constructor(opts: HubOptions) {
        this.maxBufferedBytes = opts.maxBufferedBytes;
    }

    join(room: string, conn: Connection): void {
        let members = this.rooms.get(room);
        if (!members) {
            members = [];
            this.rooms.set(room, members);
        }
        if (!members.includes(conn)) members.push(conn);
    }

    leave(room: string, conn: Connection): void {
        const members = this.rooms.get(room);
        if (!members) return;
        const i = members.indexOf(conn);
        if (i >= 0) members.splice(i, 1);
        if (members.length === 0) this.rooms.delete(room);
    }

    leaveAll(conn: Connection): void {
        for (const room of [...this.rooms.keys()]) this.leave(room, conn);
    }

    size(room: string): number {
        return this.rooms.get(room)?.length ?? 0;
    }

    // Sends one event to everyone in the room. Returns how many connections it was written to.
    broadcast(room: string, event: object): number {
        const members = this.rooms.get(room);
        if (!members) return 0;
        const frame = JSON.stringify(event);
        let delivered = 0;
        for (const conn of members) {
            if (conn.readyState !== "open") {
                this.leaveAll(conn);
                continue;
            }
            if (conn.bufferedAmount > this.maxBufferedBytes) {
                conn.close(CLOSE_TRY_AGAIN_LATER, "client too slow");
                this.leaveAll(conn);
                continue;
            }
            conn.send(frame);
            delivered++;
        }
        return delivered;
    }
}
