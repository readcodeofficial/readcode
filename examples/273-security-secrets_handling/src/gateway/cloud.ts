import { createHmac, timingSafeEqual } from "node:crypto";
import type { GatewayConfig } from "./config.ts";

export interface Reading {
    sensorId: string;
    at: string;
    value: number;
}

export interface OutboundRequest {
    method: "POST";
    url: string;
    headers: Record<string, string>;
    body: string;
}

// Batch of sensor readings sent to the cloud ingest API.
export function buildUplinkRequest(config: GatewayConfig, readings: Reading[]): OutboundRequest {
    return {
        method: "POST",
        url: `${config.cloud.endpoint}/v1/sites/${encodeURIComponent(config.siteId)}/readings`,
        headers: { authorization: `Bearer ${config.cloud.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ readings }),
    };
}

// Firmware manifests are signed by the release pipeline with HMAC-SHA256 over the raw manifest.
export function verifyFirmwareManifest(config: GatewayConfig, manifest: string, signatureHex: string): boolean {
    const expected = createHmac("sha256", config.ota.signingSecret).update(manifest).digest();
    const given = Buffer.from(signatureHex, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
}
