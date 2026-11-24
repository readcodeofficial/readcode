'use strict';

const express = require('express');
const { SlotConflictError } = require('./store');

const MAX_PAGE = 100;
const DEFAULT_PAGE = 20;

function problem(res, status, title, detail) {
  return res
    .status(status)
    .type('application/problem+json')
    .json({ type: 'about:blank', title, status, detail });
}

function present(appt) {
  return {
    id: appt.id,
    status: appt.status,
    startsAt: appt.startsAt,
    reason: appt.reason,
    links: {
      self: `/v1/appointments/${appt.id}`,
      patient: `/v1/patients/${appt.patientId}`,
      provider: `/v1/providers/${appt.providerId}`,
    },
  };
}

function appointmentsRouter(store) {
  const router = express.Router();

  router.post('/', (req, res) => {
    const { patientId, providerId, startsAt, reason } = req.body ?? {};
    if (!patientId || !providerId || Number.isNaN(Date.parse(startsAt))) {
      return problem(res, 422, 'Invalid appointment', 'patientId, providerId and startsAt are required');
    }
    try {
      const appt = store.create({ patientId, providerId, startsAt, reason });
      return res
        .status(201)
        .location(`/v1/appointments/${appt.id}`)
        .set('ETag', store.etag(appt.id))
        .json(present(appt));
    } catch (err) {
      if (err instanceof SlotConflictError) {
        return problem(res, 409, 'Slot unavailable', err.message);
      }
      throw err;
    }
  });

  router.get('/', (req, res) => {
    const limit = Math.min(Number.parseInt(req.query.limit, 10) || DEFAULT_PAGE, MAX_PAGE);
    const { page, nextAfter } = store.list({
      patientId: req.query.patientId,
      status: req.query.status,
      limit,
      after: req.query.after,
    });
    const body = { items: page.map(present) };
    if (nextAfter) {
      body.next = `/v1/appointments?limit=${limit}&after=${nextAfter}`;
    }
    res.json(body);
  });

  router.get('/:id', (req, res) => {
    const appt = store.get(req.params.id);
    if (!appt) return problem(res, 404, 'Not found', `no appointment ${req.params.id}`);
    res.set('ETag', store.etag(appt.id)).json(present(appt));
  });

  router.put('/:id/start', (req, res) => {
    const { startsAt } = req.body ?? {};
    if (Number.isNaN(Date.parse(startsAt))) {
      return problem(res, 422, 'Invalid start time', 'startsAt must be an ISO-8601 timestamp');
    }
    const current = store.get(req.params.id);
    if (!current) return problem(res, 404, 'Not found', `no appointment ${req.params.id}`);
    if (req.get('If-Match') !== store.etag(current.id)) {
      return problem(res, 412, 'Stale representation', 'appointment changed since it was read');
    }
    const updated = store.reschedule(current.id, startsAt);
    res.set('ETag', store.etag(updated.id)).json(present(updated));
  });

  router.get('/:id/cancel', (req, res) => {
    const appt = store.cancel(req.params.id);
    if (!appt) return problem(res, 404, 'Not found', `no appointment ${req.params.id}`);
    res.status(200).json(present(appt));
  });

  return router;
}

module.exports = { appointmentsRouter };
