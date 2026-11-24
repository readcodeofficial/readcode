package com.ridenow.dispatch

import io.mockk.mockk
import io.mockk.verify
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

class DispatchServiceTest {
    private val pickup = GeoPoint(37.7749, -122.4194)
    private val directory = FakeDriverDirectory()
    private val gateway = ScriptedOfferGateway()
    private val store = InMemoryAssignmentStore()
    private val metrics = mockk<DispatchMetrics>(relaxed = true)
    private val service = DispatchService(directory, gateway, store, metrics)

    private fun request() = RideRequest("req-1", "rider-9", pickup)

    private fun driverAt(id: String, km: Double, rating: Double = 4.8) =
        Driver(id, GeoPoint(pickup.lat + km / 111.0, pickup.lng), rating)

    @Test
    fun `offers go to the nearest drivers first and stop at the first acceptance`() {
        directory.add(driverAt("far", 3.0))
        directory.add(driverAt("mid", 2.0))
        directory.add(driverAt("near", 1.0))
        gateway.script("near", OfferResult.Declined)
        gateway.script("mid", OfferResult.Accepted)

        val result = service.dispatch(request())

        assertEquals(DispatchResult.Assigned("mid"), result)
        assertEquals(listOf("near", "mid"), gateway.offered)
        assertEquals("mid", store.driverFor("req-1"))
        verify(exactly = 1) { metrics.offerDeclined() }
    }

    @Test
    fun `never makes more offers than the configured maximum`() {
        for (i in 1..5) directory.add(driverAt("d$i", i * 0.5))

        val result = service.dispatch(request())

        assertEquals(DispatchResult.NoDriver, result)
        assertEquals(listOf("d1", "d2", "d3"), gateway.offered)
        verify(exactly = 3) { metrics.offerTimedOut() }
        verify(exactly = 1) { metrics.noDriverFound() }
    }

    @Test
    fun `ignores drivers outside the search radius`() {
        directory.add(driverAt("distant", 7.0))

        val result = service.dispatch(request())

        assertEquals(DispatchResult.NoDriver, result)
        assertTrue(gateway.offered.isEmpty())
        assertNull(store.driverFor("req-1"))
    }

    @Test
    fun `reports a lost race when the request was assigned meanwhile`() {
        directory.add(driverAt("d1", 1.0))
        gateway.script("d1", OfferResult.Accepted)
        store.preassign("req-1", "someone-else")

        val result = service.dispatch(request())

        assertEquals(DispatchResult.AlreadyAssigned, result)
        assertEquals("someone-else", store.driverFor("req-1"))
        verify(exactly = 0) { metrics.noDriverFound() }
    }

    @Test
    fun `breaks distance ties by rating`() {
        directory.add(driverAt("low", 1.0, rating = 4.2))
        directory.add(driverAt("high", 1.0, rating = 4.9))

        service.dispatch(request())

        assertEquals(listOf("high", "low"), gateway.offered)
    }
}
