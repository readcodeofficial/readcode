package com.freightline.manifests

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.ktor.http.HttpStatusCode
import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.install
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.routing
import kotlinx.coroutines.channels.ClosedSendChannelException

fun main() {
    val config = AppConfig.fromEnv()
    val dataSource = HikariDataSource(HikariConfig().apply {
        jdbcUrl = config.jdbcUrl
        maximumPoolSize = 10
    })
    val repo = ManifestRepository(dataSource)
    val worker = ManifestWorker(repo, CarrierGateway(config.carrierUrl), concurrency = 4)
    val health = HealthState()

    val server = embeddedServer(Netty, port = config.port) {
        install(ContentNegotiation) { json() }
        routing {
            get("/healthz") { call.respond(HttpStatusCode.OK) }
            get("/readyz") {
                call.respond(if (health.ready) HttpStatusCode.OK else HttpStatusCode.ServiceUnavailable)
            }
            post("/manifests") {
                val request = call.receive<NewManifest>()
                val id = repo.insertQueued(request)
                try {
                    worker.submit(ManifestJob(id, request))
                    call.respond(HttpStatusCode.Accepted, mapOf("id" to id))
                } catch (e: ClosedSendChannelException) {
                    call.respond(HttpStatusCode.ServiceUnavailable)
                }
            }
        }
    }

    val coordinator = ShutdownCoordinator(server, worker, dataSource, health, config)
    Runtime.getRuntime().addShutdownHook(Thread(coordinator::run, "shutdown"))

    repo.requeueStale()
    worker.start()
    server.start(wait = true)
}
