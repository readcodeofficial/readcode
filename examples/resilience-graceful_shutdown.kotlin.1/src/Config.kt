package com.freightline.manifests

data class AppConfig(
    val port: Int,
    val jdbcUrl: String,
    val carrierUrl: String,
    val loadBalancerDelayMs: Long,
    val drainTimeoutMs: Long,
) {
    companion object {
        fun fromEnv() = AppConfig(
            port = System.getenv("PORT")?.toInt() ?: 8080,
            jdbcUrl = requireNotNull(System.getenv("DATABASE_URL")) { "DATABASE_URL is required" },
            carrierUrl = requireNotNull(System.getenv("CARRIER_URL")) { "CARRIER_URL is required" },
            loadBalancerDelayMs = System.getenv("LB_DELAY_MS")?.toLong() ?: 5_000,
            drainTimeoutMs = System.getenv("DRAIN_TIMEOUT_MS")?.toLong() ?: 20_000,
        )
    }
}
