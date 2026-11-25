export interface Webhook {
    url: string;
    authToken: string;
}

export interface GatewayConfig {
    siteId: string;
    logLevel: "debug" | "info" | "warn";
    mqtt: { url: string; username: string; password: string };
    cloud: { region: string; endpoint: string; apiKey: string };
    ota: { channel: string; signingSecret: string };
    alertWebhooks: Webhook[];
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string): string {
    const value = env[name]?.trim();
    if (!value) throw new Error(`missing required setting ${name}`);
    return value;
}

// Builds the gateway config from environment variables (injected by the device provisioning agent).
export function loadConfig(env: Env): GatewayConfig {
    const logLevel = env.LOG_LEVEL ?? "info";
    if (logLevel !== "debug" && logLevel !== "info" && logLevel !== "warn") throw new Error(`bad LOG_LEVEL ${logLevel}`);

    const webhooks: unknown = JSON.parse(env.ALERT_WEBHOOKS ?? "[]");
    if (!Array.isArray(webhooks) || !webhooks.every((w) => typeof w?.url === "string" && typeof w?.authToken === "string")) {
        throw new Error("ALERT_WEBHOOKS must be a JSON array of { url, authToken }");
    }

    return {
        siteId: required(env, "SITE_ID"),
        logLevel,
        mqtt: { url: required(env, "MQTT_URL"), username: required(env, "MQTT_USERNAME"), password: required(env, "MQTT_PASSWORD") },
        cloud: { region: env.CLOUD_REGION ?? "eu-west-1", endpoint: required(env, "CLOUD_ENDPOINT"), apiKey: required(env, "CLOUD_API_KEY") },
        ota: { channel: env.OTA_CHANNEL ?? "stable", signingSecret: required(env, "OTA_SIGNING_SECRET") },
        alertWebhooks: webhooks as Webhook[],
    };
}
