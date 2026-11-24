import { WebSocket } from "ws";

const MAX_BUFFERED_BYTES = 256 * 1024;
const HEARTBEAT_MS = 30_000;
const CLOSE_SESSION_REVOKED = 4001;

export class SessionHub {
  constructor({ subscriber, nodeId, logger = console }) {
    this.subscriber = subscriber;
    this.nodeId = nodeId;
    this.logger = logger;
    this.socketsByUser = new Map();
    this.heartbeat = null;
  }

  async start() {
    await this.subscriber.subscribe("session-events", (raw) => this.onMessage(raw));
    this.heartbeat = setInterval(() => this.sweep(), HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  attach(userId, ws) {
    let set = this.socketsByUser.get(userId);
    if (!set) {
      set = new Set();
      this.socketsByUser.set(userId, set);
    }
    set.add(ws);
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    ws.on("close", () => this.detach(userId, ws));
    ws.on("error", (err) => {
      this.logger.warn("socket error", { userId, message: err.message });
      ws.terminate();
    });
  }

  detach(userId, ws) {
    const set = this.socketsByUser.get(userId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) {
      this.socketsByUser.delete(userId);
    }
  }

  onMessage(raw) {
    let event;
    try {
      event = JSON.parse(raw);
    } catch (err) {
      this.logger.warn("dropping malformed session event", { message: err.message });
      return;
    }
    if (typeof event.userId !== "string" || typeof event.type !== "string") {
      this.logger.warn("dropping session event with missing fields");
      return;
    }
    if (event.type === "revoked") {
      this.revokeUser(event.userId, event.reason);
    } else {
      this.sendToUser(event.userId, raw);
    }
  }

  sendToUser(userId, payload) {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets) return 0;
    let delivered = 0;
    for (const ws of [...sockets]) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      if (ws.bufferedAmount > MAX_BUFFERED_BYTES) {
        this.logger.warn("closing slow consumer", { userId, buffered: ws.bufferedAmount });
        ws.terminate();
        continue;
      }
      ws.send(payload, (err) => {
        if (err) ws.terminate();
      });
      delivered += 1;
    }
    return delivered;
  }

  revokeUser(userId, reason = "revoked") {
    const sockets = this.socketsByUser.get(userId);
    if (!sockets) return;
    for (const ws of [...sockets]) {
      ws.close(CLOSE_SESSION_REVOKED, String(reason).slice(0, 100));
    }
  }

  sweep() {
    for (const sockets of this.socketsByUser.values()) {
      for (const ws of [...sockets]) {
        if (!ws.isAlive) {
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
    }
  }

  async stop() {
    clearInterval(this.heartbeat);
    await this.subscriber.unsubscribe("session-events");
    for (const sockets of this.socketsByUser.values()) {
      for (const ws of [...sockets]) ws.close(1001, "server shutting down");
    }
  }
}
