import { EventEmitter } from "node:events";

export class Worker extends EventEmitter {
  constructor({ queue, handlers, logger }) {
    super();
    this.queue = queue;
    this.handlers = handlers;
    this.logger = logger;
  }

  async processNext() {
    const job = await this.queue.take();
    if (!job) return false;

    try {
      const handler = this.handlers[job.type];
      if (!handler) throw new Error(`no handler for job type ${job.type}`);
      await handler(job.payload);
    } catch (err) {
      this.logger.error(`job ${job.id} failed: ${err.message}`);
    }

    await this.queue.ack(job.id);
    this.emit("processed", job.id);
    return true;
  }

  async drain() {
    let handled = 0;
    while (await this.processNext()) handled += 1;
    return handled;
  }
}
