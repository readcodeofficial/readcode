import { randomUUID } from "node:crypto";
import { UnrecoverableError, Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import type { Logger } from "pino";
import { EndpointRepo, WEBHOOK_QUEUE, WebhookJob } from "./enqueue";
import { signPayload } from "./signer";

const DELIVERY_TIMEOUT_MS = 10_000;

export function createDeliveryWorker(connection: ConnectionOptions, endpoints: EndpointRepo, log: Logger) {
  const worker = new Worker<WebhookJob>(
    WEBHOOK_QUEUE,
    async (job) => {
      const endpoint = await endpoints.get(job.data.endpointId);
      if (!endpoint || !endpoint.active) {
        throw new UnrecoverableError("endpoint missing or disabled");
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        type: job.data.eventType,
        timestamp: job.data.occurredAt,
        data: job.data.data,
      });
      const messageId = randomUUID();

      const res = await fetch(endpoint.url, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
        headers: {
          "content-type": "application/json",
          "user-agent": "filesync-webhooks/1.0",
          "webhook-id": messageId,
          "webhook-timestamp": String(timestamp),
          "webhook-signature": signPayload(endpoint.secret, messageId, timestamp, body),
        },
        body,
      });
      await res.body?.cancel();

      if (res.ok) {
        return { status: res.status };
      }
      if (res.status === 410) {
        await endpoints.disable(endpoint.id, "endpoint returned 410 Gone");
        throw new UnrecoverableError("endpoint gone");
      }
      const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
      if (!retryable) {
        throw new UnrecoverableError(`endpoint rejected delivery with ${res.status}`);
      }
      throw new Error(`endpoint returned ${res.status}`);
    },
    { connection, concurrency: 20 },
  );

  worker.on("failed", (job, err) => {
    log.warn(
      { jobId: job?.id, endpointId: job?.data.endpointId, attempt: job?.attemptsMade, err: err.message },
      "webhook delivery failed",
    );
  });
  return worker;
}
