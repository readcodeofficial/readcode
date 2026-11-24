package com.acme.notify.config

import java.nio.file.Path
import java.time.Duration

data class QuietHours(val startHour: Int, val endHour: Int) {
    fun contains(hour: Int): Boolean =
        if (startHour <= endHour) hour in startHour until endHour
        else hour >= startHour || hour < endHour
}

data class SmsConfig(
    val gatewayUrl: String,
    val apiKey: String,
    val maxPerSecond: Int,
)

data class PushConfig(
    val credentialsPath: Path,
    val batchSize: Int,
    val sendTimeout: Duration,
)

data class NotifyConfig(
    val environment: String,
    val sms: SmsConfig,
    val push: PushConfig,
    val quietHours: QuietHours,
)

class ConfigException(val problems: List<String>) :
    RuntimeException("Invalid configuration:\n" + problems.joinToString("\n") { " - $it" })
