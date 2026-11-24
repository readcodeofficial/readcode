package com.acme.notify

import com.acme.notify.config.ConfigException
import com.acme.notify.config.ConfigLoader
import kotlin.system.exitProcess

fun main() {
    val config = try {
        ConfigLoader(System.getenv()).load()
    } catch (e: ConfigException) {
        System.err.println(e.message)
        exitProcess(78)
    }
    println("starting notify service in ${config.environment} with ${config.sms.maxPerSecond} sms/s")
}
