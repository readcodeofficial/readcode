package com.ridenow.dispatch

import java.time.Duration
import kotlin.math.cos
import kotlin.math.hypot

data class GeoPoint(val lat: Double, val lng: Double)

data class Driver(val id: String, val location: GeoPoint, val rating: Double)

data class RideRequest(val id: String, val riderId: String, val pickup: GeoPoint)

enum class OfferResult { Accepted, Declined, TimedOut }

sealed interface DispatchResult {
    data class Assigned(val driverId: String) : DispatchResult
    object AlreadyAssigned : DispatchResult
    object NoDriver : DispatchResult
}

interface DriverDirectory {
    fun availableNear(point: GeoPoint, radiusKm: Double): List<Driver>
}

interface OfferGateway {
    fun offer(driverId: String, request: RideRequest, timeout: Duration): OfferResult
}

interface AssignmentStore {
    /** Returns false when the request already has a driver. */
    fun assign(requestId: String, driverId: String): Boolean
}

interface DispatchMetrics {
    fun offerDeclined()
    fun offerTimedOut()
    fun noDriverFound()
}

fun distanceKm(a: GeoPoint, b: GeoPoint): Double {
    val dLat = (b.lat - a.lat) * 111.0
    val dLng = (b.lng - a.lng) * 111.0 * cos(Math.toRadians((a.lat + b.lat) / 2))
    return hypot(dLat, dLng)
}

class DispatchService(
    private val directory: DriverDirectory,
    private val offers: OfferGateway,
    private val assignments: AssignmentStore,
    private val metrics: DispatchMetrics,
    private val searchRadiusKm: Double = 5.0,
    private val maxOffers: Int = 3,
    private val offerTimeout: Duration = Duration.ofSeconds(12),
) {
    fun dispatch(request: RideRequest): DispatchResult {
        val candidates = directory.availableNear(request.pickup, searchRadiusKm)
            .sortedWith(
                compareBy<Driver> { distanceKm(request.pickup, it.location) }
                    .thenByDescending { it.rating }
            )
            .take(maxOffers)

        for (driver in candidates) {
            when (offers.offer(driver.id, request, offerTimeout)) {
                OfferResult.Accepted -> {
                    return if (assignments.assign(request.id, driver.id)) {
                        DispatchResult.Assigned(driver.id)
                    } else {
                        DispatchResult.AlreadyAssigned
                    }
                }
                OfferResult.Declined -> metrics.offerDeclined()
                OfferResult.TimedOut -> metrics.offerTimedOut()
            }
        }

        metrics.noDriverFound()
        return DispatchResult.NoDriver
    }
}
