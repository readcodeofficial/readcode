'use strict';

const express = require('express');
const { AppointmentStore } = require('./store');
const { appointmentsRouter } = require('./routes');

function buildApp(store = new AppointmentStore()) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.use('/v1/appointments', appointmentsRouter(store));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).type('application/problem+json').json({
      type: 'about:blank',
      title: 'Internal error',
      status: 500,
    });
  });
  return app;
}

module.exports = { buildApp };
