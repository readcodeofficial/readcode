'use strict';

const RECENT_EVENT_LIMIT = 50;
const DUPLICATE_KEY = 11000;

const STATUS_BY_EVENT = {
  label_created: 'created',
  picked_up: 'in_transit',
  arrived_hub: 'in_transit',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  delivery_failed: 'exception',
};

async function ensureIndexes(db) {
  await db.collection('shipments').createIndex({ carrierId: 1, status: 1, lastEventAt: -1 });
  await db.collection('shipments').createIndex({ trackingNumber: 1 }, { unique: true });
  await db.collection('shipment_events').createIndex({ shipmentId: 1, occurredAt: -1, _id: -1 });
}

class ShipmentStore {
  constructor(client, db) {
    this.client = client;
    this.shipments = db.collection('shipments');
    this.events = db.collection('shipment_events');
  }

  async create({ id, trackingNumber, carrierId, origin, destination }) {
    const doc = {
      _id: id,
      trackingNumber,
      carrierId,
      origin,
      destination,
      status: 'created',
      statusAt: new Date(0),
      lastEventAt: new Date(0),
      eventCount: 0,
      recentEvents: [],
    };
    await this.shipments.insertOne(doc);
    return id;
  }

  // Returns false when the event id was already recorded.
  async recordEvent(shipmentId, event) {
    const session = this.client.startSession();
    try {
      await session.withTransaction(async () => {
        await this.events.insertOne(
          {
            _id: event.id,
            shipmentId,
            type: event.type,
            location: event.location,
            occurredAt: event.occurredAt,
          },
          { session },
        );

        const embedded = { id: event.id, type: event.type, location: event.location, at: event.occurredAt };
        const pushed = await this.shipments.updateOne(
          { _id: shipmentId },
          {
            $push: { recentEvents: { $each: [embedded], $sort: { at: -1 }, $slice: RECENT_EVENT_LIMIT } },
            $inc: { eventCount: 1 },
            $max: { lastEventAt: event.occurredAt },
          },
          { session },
        );
        if (pushed.matchedCount === 0) {
          throw new Error(`unknown shipment ${shipmentId}`);
        }

        const status = STATUS_BY_EVENT[event.type];
        if (status) {
          await this.shipments.updateOne(
            { _id: shipmentId, statusAt: { $lt: event.occurredAt } },
            { $set: { status, statusAt: event.occurredAt } },
            { session },
          );
        }
      });
      return true;
    } catch (err) {
      if (err.code === DUPLICATE_KEY) return false;
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async getSummary(shipmentId) {
    return this.shipments.findOne({ _id: shipmentId }, { projection: { recentEvents: 1, status: 1, eventCount: 1 } });
  }

  async getHistory(shipmentId, { before, limit = 100 } = {}) {
    const filter = { shipmentId };
    if (before) filter.occurredAt = { $lt: before };
    const page = await this.events
      .find(filter)
      .sort({ occurredAt: -1, _id: -1 })
      .limit(Math.min(limit, 500) + 1)
      .toArray();
    const hasMore = page.length > Math.min(limit, 500);
    const items = hasMore ? page.slice(0, -1) : page;
    return { items, nextBefore: hasMore ? items[items.length - 1].occurredAt : null };
  }

  async listStuck(carrierId, olderThan) {
    return this.shipments
      .find({ carrierId, status: 'in_transit', lastEventAt: { $lt: olderThan } })
      .sort({ lastEventAt: -1 })
      .limit(200)
      .project({ trackingNumber: 1, lastEventAt: 1 })
      .toArray();
  }
}

module.exports = { ShipmentStore, ensureIndexes, RECENT_EVENT_LIMIT };
