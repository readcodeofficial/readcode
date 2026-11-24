'use strict';

const express = require('express');

function trackingRouter(store) {
  const router = express.Router();

  router.post('/shipments/:id/events', express.json(), async (req, res, next) => {
    try {
      const { id: eventId, type, location, occurredAt } = req.body;
      if (!eventId || !type || !occurredAt) {
        return res.status(400).json({ error: 'id, type and occurredAt are required' });
      }
      const recorded = await store.recordEvent(req.params.id, {
        id: eventId,
        type,
        location,
        occurredAt: new Date(occurredAt),
      });
      return res.status(recorded ? 201 : 200).json({ recorded });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/shipments/:id', async (req, res, next) => {
    try {
      const summary = await store.getSummary(req.params.id);
      if (!summary) return res.status(404).json({ error: 'not found' });
      return res.json({
        status: summary.status,
        totalEvents: summary.eventCount,
        latest: summary.recentEvents,
      });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/shipments/:id/history', async (req, res, next) => {
    try {
      const before = req.query.before ? new Date(req.query.before) : undefined;
      const limit = Number.parseInt(req.query.limit, 10) || 100;
      return res.json(await store.getHistory(req.params.id, { before, limit }));
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

module.exports = { trackingRouter };
