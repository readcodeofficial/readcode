'use strict';

const express = require('express');
const { NoDriversAvailableError, TripStateError } = require('./errors');

function dispatchRoutes(dispatchService) {
  const router = express.Router();

  router.post('/trips/:tripId/assign', async (req, res, next) => {
    try {
      const result = await dispatchService.assignDriver(req.params.tripId);
      res.status(200).json({
        tripId: result.tripId,
        driverId: result.driverId,
        notified: result.notified,
      });
    } catch (err) {
      if (err instanceof NoDriversAvailableError) {
        res.set('Retry-After', '5');
        return res.status(503).json({ error: 'no_drivers_available' });
      }
      if (err instanceof TripStateError) {
        return res.status(409).json({ error: 'trip_not_assignable', status: err.status });
      }
      return next(err);
    }
  });

  return router;
}

function errorHandler(logger) {
  return (err, req, res, next) => {
    logger.error({ err, path: req.path }, 'unhandled error');
    if (res.headersSent) {
      return next(err);
    }
    return res.status(500).json({ error: 'internal_error' });
  };
}

module.exports = { dispatchRoutes, errorHandler };
