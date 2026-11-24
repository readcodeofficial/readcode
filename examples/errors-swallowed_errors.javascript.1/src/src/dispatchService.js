'use strict';

const { withTransaction } = require('./db');
const { NoDriversAvailableError, TripStateError, DispatchError } = require('./errors');
const logger = require('./logger');
const metrics = require('./metrics');

class DispatchService {
  constructor({ pool, notifier, tripCache }) {
    this.pool = pool;
    this.notifier = notifier;
    this.tripCache = tripCache;
  }

  async assignDriver(tripId) {
    const assignment = await withTransaction(this.pool, async (client) => {
      const { rows: trips } = await client.query(
        'SELECT id, status, pickup_lat, pickup_lng, rider_id FROM trips WHERE id = $1 FOR UPDATE',
        [tripId],
      );
      if (trips.length === 0) {
        throw new DispatchError(`trip ${tripId} does not exist`);
      }
      const trip = trips[0];
      if (trip.status !== 'requested') {
        throw new TripStateError(tripId, trip.status);
      }

      const { rows: drivers } = await client.query(
        `SELECT id FROM drivers
          WHERE status = 'available'
          ORDER BY point(last_lng, last_lat) <-> point($2, $1)
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
        [trip.pickup_lat, trip.pickup_lng],
      );
      if (drivers.length === 0) {
        throw new NoDriversAvailableError(tripId);
      }

      const driverId = drivers[0].id;
      await client.query("UPDATE drivers SET status = 'on_trip' WHERE id = $1", [driverId]);
      await client.query(
        "UPDATE trips SET status = 'assigned', driver_id = $2, assigned_at = now() WHERE id = $1",
        [tripId, driverId],
      );
      return { tripId, driverId, riderId: trip.rider_id };
    });

    const notified = await this.notifyAssignment(assignment);
    await this.invalidateCache(tripId);
    return { ...assignment, notified };
  }

  async notifyAssignment({ tripId, driverId, riderId }) {
    const results = await Promise.allSettled([
      this.notifier.pushToDriver(driverId, { type: 'trip_assigned', tripId }),
      this.notifier.pushToRider(riderId, { type: 'driver_assigned', tripId, driverId }),
    ]);

    let allDelivered = true;
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        allDelivered = false;
        const target = i === 0 ? 'driver' : 'rider';
        metrics.increment('dispatch.notification_failed', { target });
        logger.warn({ err: result.reason, tripId, target }, 'assignment notification failed');
      }
    });
    return allDelivered;
  }

  async invalidateCache(tripId) {
    try {
      await this.tripCache.del(`trip:${tripId}`);
    } catch (err) {
      metrics.increment('dispatch.cache_invalidation_failed');
      logger.warn({ err, tripId }, 'trip cache invalidation failed, entry will expire by ttl');
    }
  }
}

module.exports = { DispatchService };
