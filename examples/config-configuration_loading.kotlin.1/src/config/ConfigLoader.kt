package com.acme.notify.config

import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths
import java.time.Duration

private const val DEFAULT_SMS_RATE = 50
private const val DEFAULT_PUSH_BATCH = 200
private const val CARRIER_RATE_CEILING = 100

class ConfigLoader(private val env: Map<String, String>) {
    private val problems = mutableListOf<String>()

    fun load(): NotifyConfig {
        val environment = env["NOTIFY_ENV"]?.lowercase() ?: "production"
        if (environment !in setOf("production", "staging", "dev")) {
            problems += "NOTIFY_ENV must be production, staging or dev (was '$environment')"
        }

        val sms = SmsConfig(
            gatewayUrl = required("SMS_GATEWAY_URL"),
            apiKey = required("SMS_API_KEY"),
            maxPerSecond = env["SMS_MAX_PER_SECOND"]?.toIntOrNull() ?: DEFAULT_SMS_RATE,
        )
        if (sms.maxPerSecond !in 1..CARRIER_RATE_CEILING) {
            problems += "SMS_MAX_PER_SECOND must be between 1 and $CARRIER_RATE_CEILING"
        }

        val credentials = requiredPath("FCM_CREDENTIALS_PATH")
        val push = PushConfig(
            credentialsPath = credentials,
            batchSize = optionalInt("PUSH_BATCH_SIZE", DEFAULT_PUSH_BATCH),
            sendTimeout = Duration.ofMillis(optionalInt("PUSH_TIMEOUT_MS", 3000).toLong()),
        )
        if (push.batchSize !in 1..1000) {
            problems += "PUSH_BATCH_SIZE must be between 1 and 1000"
        }

        val quiet = parseQuietHours(env["QUIET_HOURS"] ?: "22-7")

        if (problems.isNotEmpty()) throw ConfigException(problems.toList())
        return NotifyConfig(environment, sms, push, quiet)
    }

    private fun required(key: String): String {
        val value = env[key]?.trim()
        if (value.isNullOrEmpty()) {
            problems += "$key is required"
            return ""
        }
        return value
    }

    private fun requiredPath(key: String): Path {
        val raw = required(key)
        val path = Paths.get(raw)
        if (raw.isNotEmpty() && !Files.isReadable(path)) {
            problems += "$key points to an unreadable file: $raw"
        }
        return path
    }

    private fun optionalInt(key: String, default: Int): Int {
        val raw = env[key] ?: return default
        return raw.trim().toIntOrNull() ?: run {
            problems += "$key must be an integer (was '$raw')"
            default
        }
    }

    private fun parseQuietHours(raw: String): QuietHours {
        val parts = raw.split("-")
        val start = parts.getOrNull(0)?.trim()?.toIntOrNull()
        val end = parts.getOrNull(1)?.trim()?.toIntOrNull()
        if (parts.size != 2 || start == null || end == null || start !in 0..23 || end !in 0..23) {
            problems += "QUIET_HOURS must look like '22-7' (hours 0-23, was '$raw')"
            return QuietHours(0, 0)
        }
        return QuietHours(start, end)
    }
}
