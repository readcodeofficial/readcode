package com.freightline.manifests

import com.zaxxer.hikari.HikariDataSource
import io.ktor.server.engine.ApplicationEngine
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory

class HealthState {
    @Volatile
    var ready: Boolean = true
}

class ShutdownCoordinator(
    private val server: ApplicationEngine,
    private val worker: ManifestWorker,
    private val dataSource: HikariDataSource,
    private val health: HealthState,
    private val config: AppConfig,
) {
    private val log = LoggerFactory.getLogger(ShutdownCoordinator::class.java)

    fun run() {
        log.info("shutdown requested")
        health.ready = false
        Thread.sleep(config.loadBalancerDelayMs)

        val drained = runBlocking { worker.drain(config.drainTimeoutMs) }
        server.stop(gracePeriodMillis = 2_000, timeoutMillis = 5_000)
        if (!drained) {
            log.warn("worker did not drain within {} ms, {} manifests left queued",
                config.drainTimeoutMs, worker.abandonedCount())
        }

        dataSource.close()
        log.info("shutdown complete")
    }
}
