package com.freightline.manifests

import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CarrierGateway(private val baseUrl: String) {
    private val client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build()

    suspend fun dispatch(manifest: NewManifest): String = withContext(Dispatchers.IO) {
        val body = """{"carrier":"${manifest.carrierCode}","parcels":${manifest.parcels.size}}"""
        val request = HttpRequest.newBuilder(URI.create("$baseUrl/v1/dispatch"))
            .timeout(Duration.ofSeconds(10))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build()
        val response = client.send(request, HttpResponse.BodyHandlers.ofString())
        check(response.statusCode() == 201) { "carrier returned ${response.statusCode()}" }
        response.body().trim()
    }
}
