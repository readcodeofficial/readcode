package com.ridenow.dispatch

import java.time.Duration

class FakeDriverDirectory : DriverDirectory {
    private val drivers = mutableListOf<Driver>()

    fun add(driver: Driver) {
        drivers += driver
    }

    override fun availableNear(point: GeoPoint, radiusKm: Double): List<Driver> =
        drivers.filter { distanceKm(point, it.location) <= radiusKm }
}

class ScriptedOfferGateway : OfferGateway {
    private val script = mutableMapOf<String, OfferResult>()
    val offered = mutableListOf<String>()

    fun script(driverId: String, result: OfferResult) {
        script[driverId] = result
    }

    override fun offer(driverId: String, request: RideRequest, timeout: Duration): OfferResult {
        offered += driverId
        return script[driverId] ?: OfferResult.TimedOut
    }
}

class InMemoryAssignmentStore : AssignmentStore {
    private val byRequest = mutableMapOf<String, String>()

    fun preassign(requestId: String, driverId: String) {
        byRequest[requestId] = driverId
    }

    fun driverFor(requestId: String): String? = byRequest[requestId]

    override fun assign(requestId: String, driverId: String): Boolean =
        byRequest.putIfAbsent(requestId, driverId) == null
}
