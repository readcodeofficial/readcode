import { Queue } from "bullmq";

export interface WebhookJob {
  endpointId: string;
  eventType: string;
  occurredAt: string;
  data: unknown;
}

export interface Endpoint {
  id: string;
  url: string;
  secret: string;
  active: boolean;
  eventTypes: string[];
}

export interface EndpointRepo {
  listForAccount(accountId: string): Promise<Endpoint[]>;
  get(endpointId: string): Promise<Endpoint | null>;
  disable(endpointId: string, reason: string): Promise<void>;
}

export interface StorageEvent {
  id: string;
  accountId: string;
  type: string;
  occurredAt: string;
  data: unknown;
}

export const WEBHOOK_QUEUE = "webhook-delivery";

export async function enqueueWebhooks(
  queue: Queue<WebhookJob>,
  endpoints: EndpointRepo,
  event: StorageEvent,
): Promise<number> {
  const targets = (await endpoints.listForAccount(event.accountId)).filter(
    (e) => e.active && e.eventTypes.includes(event.type),
  );

  await Promise.all(
    targets.map((endpoint) =>
      queue.add(
        "deliver",
        { endpointId: endpoint.id, eventType: event.type, occurredAt: event.occurredAt, data: event.data },
        {
          jobId: `${event.id}:${endpoint.id}`,
          attempts: 8,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: 1_000,
          removeOnFail: false,
        },
      ),
    ),
  );
  return targets.length;
}
