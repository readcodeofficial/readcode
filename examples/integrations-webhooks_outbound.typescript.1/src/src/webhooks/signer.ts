import { createHmac } from "node:crypto";

export function signPayload(secret: string, messageId: string, timestamp: number, body: string): string {
  const key = Buffer.from(secret, "base64");
  const mac = createHmac("sha256", key).update(`${messageId}.${timestamp}.${body}`).digest("base64");
  return `v1,${mac}`;
}
