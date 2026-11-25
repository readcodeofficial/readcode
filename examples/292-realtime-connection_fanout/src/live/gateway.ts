import { CLOSE_POLICY_VIOLATION, type Connection } from "./connection.ts";
import type { Hub } from "./hub.ts";
import { BidRejected, type Auctions } from "./auctions.ts";

type ClientMessage = { op: "watch"; lotId: string } | { op: "unwatch"; lotId: string } | { op: "bid"; lotId: string; amountCents: number };

// Handles frames from one bidder's socket. The bidder id comes from the authenticated session.
export function attach(hub: Hub, auctions: Auctions, conn: Connection, bidderId: string) {
    return {
        onMessage(raw: string): void {
            let msg: ClientMessage;
            try {
                msg = JSON.parse(raw);
            } catch {
                conn.close(CLOSE_POLICY_VIOLATION, "malformed frame");
                hub.leaveAll(conn);
                return;
            }
            try {
                if (msg.op === "watch") hub.join(auctions.room(msg.lotId), conn);
                else if (msg.op === "unwatch") hub.leave(auctions.room(msg.lotId), conn);
                else if (msg.op === "bid") auctions.placeBid(msg.lotId, bidderId, msg.amountCents);
                else conn.send(JSON.stringify({ type: "error", message: "unknown op" }));
            } catch (err) {
                if (!(err instanceof BidRejected)) throw err;
                conn.send(JSON.stringify({ type: "error", message: err.message }));
            }
        },
        onClose(): void {
            hub.leaveAll(conn);
        },
    };
}
