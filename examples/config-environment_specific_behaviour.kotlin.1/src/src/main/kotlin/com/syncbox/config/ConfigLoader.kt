package com.syncbox.config

import java.nio.file.Path
import java.nio.file.Paths
import java.time.Duration

data class StorageConfig(
    val bucket: String,
    val endpoint: String?,
    val pathStyleAccess: Boolean,
    val verifyTls: Boolean,
)

data class SyncConfig(
    val pollInterval: Duration,
    val maxFileBytes: Long,
    val scratchDir: Path,
)

data class AppConfig(
    val env: Environment,
    val storage: StorageConfig,
    val sync: SyncConfig,
    val exposeDebugEndpoints: Boolean,
    val logJson: Boolean,
    val encryptionKeyId: String,
)

class ConfigLoader(private val source: (String) -> String?) {

    fun load(): AppConfig {
        val env = Environment.parse(source("APP_ENV"))
        return AppConfig(
            env = env,
            storage = storage(env),
            sync = sync(env),
            exposeDebugEndpoints = env == Environment.LOCAL,
            logJson = env != Environment.LOCAL,
            encryptionKeyId = encryptionKey(env),
        )
    }

    private fun storage(env: Environment): StorageConfig = when (env) {
        Environment.LOCAL -> StorageConfig(
            bucket = source("STORAGE_BUCKET") ?: "syncbox-dev",
            endpoint = source("STORAGE_ENDPOINT") ?: "http://localhost:9000",
            pathStyleAccess = true,
            verifyTls = false,
        )
        Environment.STAGING, Environment.PRODUCTION -> StorageConfig(
            bucket = required("STORAGE_BUCKET"),
            endpoint = source("STORAGE_ENDPOINT"),
            pathStyleAccess = false,
            verifyTls = true,
        )
    }

    private fun sync(env: Environment): SyncConfig {
        val poll = source("SYNC_POLL_SECONDS")?.let { integer("SYNC_POLL_SECONDS", it) }
            ?.also { if (it !in 1..3600) throw ConfigException("SYNC_POLL_SECONDS must be between 1 and 3600") }
            ?: if (env == Environment.LOCAL) 2L else 30L
        val maxBytes = source("SYNC_MAX_FILE_MB")?.let { integer("SYNC_MAX_FILE_MB", it) }
            ?.also { if (it <= 0) throw ConfigException("SYNC_MAX_FILE_MB must be positive") }
            ?: 512L
        return SyncConfig(
            pollInterval = Duration.ofSeconds(poll),
            maxFileBytes = maxBytes * 1024 * 1024,
            scratchDir = Paths.get(source("SYNC_SCRATCH_DIR") ?: System.getProperty("java.io.tmpdir"), "syncbox"),
        )
    }

    private fun encryptionKey(env: Environment): String = when (env) {
        Environment.LOCAL -> source("KMS_KEY_ID") ?: "local-dev-key"
        Environment.STAGING -> required("KMS_KEY_ID")
        Environment.PRODUCTION -> required("KMS_KEY_ID").also {
            if (it.startsWith("alias/staging-")) {
                throw ConfigException("Production must not use a staging KMS key: $it")
            }
        }
    }

    private fun integer(name: String, raw: String): Long =
        raw.trim().toLongOrNull() ?: throw ConfigException("$name must be an integer, got '$raw'")

    private fun required(name: String): String =
        source(name)?.takeIf { it.isNotBlank() }
            ?: throw ConfigException("Missing required setting $name")
}
