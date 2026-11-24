package com.freightline.manifests

import javax.sql.DataSource
import kotlinx.serialization.Serializable

@Serializable
data class NewManifest(val shipperId: String, val carrierCode: String, val parcels: List<String>)

class ManifestRepository(private val dataSource: DataSource) {

    fun insertQueued(m: NewManifest): Long = dataSource.connection.use { conn ->
        conn.prepareStatement(
            "INSERT INTO manifests (shipper_id, carrier_code, parcels, status) VALUES (?, ?, ?, 'QUEUED') RETURNING id"
        ).use { ps ->
            ps.setString(1, m.shipperId)
            ps.setString(2, m.carrierCode)
            ps.setString(3, m.parcels.joinToString(","))
            ps.executeQuery().use { rs -> rs.next(); rs.getLong(1) }
        }
    }

    fun markDispatched(id: Long, trackingNumber: String) = update(id, "DISPATCHED", trackingNumber)

    fun markFailed(id: Long, reason: String) = update(id, "FAILED", reason)

    fun requeueStale() = dataSource.connection.use { conn ->
        conn.createStatement().use { it.executeUpdate("UPDATE manifests SET status = 'QUEUED' WHERE status = 'DISPATCHING'") }
    }

    private fun update(id: Long, status: String, detail: String) = dataSource.connection.use { conn ->
        conn.prepareStatement("UPDATE manifests SET status = ?, detail = ? WHERE id = ?").use { ps ->
            ps.setString(1, status)
            ps.setString(2, detail)
            ps.setLong(3, id)
            ps.executeUpdate()
        }
    }
}
