'use strict';

const client = require('prom-client');

const counters = new Map();

function increment(name, labels = {}) {
  const metricName = name.replace(/\./g, '_');
  if (!counters.has(metricName)) {
    counters.set(
      metricName,
      new client.Counter({ name: metricName, help: name, labelNames: Object.keys(labels) }),
    );
  }
  counters.get(metricName).inc(labels);
}

module.exports = { increment };
