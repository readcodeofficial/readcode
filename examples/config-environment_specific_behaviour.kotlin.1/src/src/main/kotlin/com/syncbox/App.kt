package com.syncbox

import com.syncbox.config.AppConfig
import com.syncbox.config.ConfigException
import com.syncbox.config.ConfigLoader
import kotlin.system.exitProcess

fun main() {
    val config = try {
        ConfigLoader(System::getenv).load()
    } catch (e: ConfigException) {
        System.err.println("Invalid configuration: ${e.message}")
        exitProcess(78)
    }

    val server = buildServer(config)
    Runtime.getRuntime().addShutdownHook(Thread { server.stop() })
    server.start()
}

fun buildServer(config: AppConfig): Server {
    val routes = mutableListOf<Route>(SyncRoutes(config.sync), HealthRoute)
    if (config.exposeDebugEndpoints) {
        routes += DebugRoutes
    }
    return Server(port = 8080, routes = routes, jsonLogs = config.logJson)
}
