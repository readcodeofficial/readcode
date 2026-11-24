package com.freightline.manifests

import java.util.concurrent.atomic.AtomicInteger
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import org.slf4j.LoggerFactory

data class ManifestJob(val id: Long, val manifest: NewManifest)

class ManifestWorker(
    private val repo: ManifestRepository,
    private val carriers: CarrierGateway,
    private val concurrency: Int,
) {
    private val log = LoggerFactory.getLogger(ManifestWorker::class.java)
    private val inbox = Channel<ManifestJob>(capacity = 64)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val consumers = mutableListOf<Job>()
    private val inFlight = AtomicInteger(0)

    suspend fun submit(job: ManifestJob) = inbox.send(job)

    fun start() {
        repeat(concurrency) { n ->
            consumers += scope.launch(CoroutineName("manifest-worker-$n")) {
                for (job in inbox) process(job)
            }
        }
    }

    private suspend fun process(job: ManifestJob) {
        inFlight.incrementAndGet()
        try {
            val trackingNumber = carriers.dispatch(job.manifest)
            repo.markDispatched(job.id, trackingNumber)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            log.error("manifest {} failed", job.id, e)
            repo.markFailed(job.id, e.message ?: e::class.java.simpleName)
        } finally {
            inFlight.decrementAndGet()
        }
    }

    suspend fun drain(timeoutMs: Long): Boolean {
        inbox.close()
        val finished = withTimeoutOrNull(timeoutMs) { consumers.joinAll() } != null
        if (!finished) scope.cancel()
        return finished
    }

    fun abandonedCount(): Int = inFlight.get()
}
