package com.syncbox.config

enum class Environment(val key: String) {
    LOCAL("local"),
    STAGING("staging"),
    PRODUCTION("production");

    val isProduction: Boolean get() = this == PRODUCTION

    companion object {
        fun parse(raw: String?): Environment {
            val value = raw?.trim()?.lowercase()
                ?: throw ConfigException("APP_ENV is not set")
            return entries.firstOrNull { it.key == value || (it == Environment.PRODUCTION && value == "prod") }
                ?: throw ConfigException("Unknown APP_ENV '$raw', expected one of ${entries.map { it.key }}")
        }
    }
}

class ConfigException(message: String) : RuntimeException(message)
