'use strict';

const { randomUUID } = require('node:crypto');

class SlotConflictError extends Error {
  constructor(providerId, startsAt) {
    super(`provider ${providerId} already booked at ${startsAt}`);
    this.name = 'SlotConflictError';
  }
}

class AppointmentStore {
  constructor() {
    this.byId = new Map();
    this.version = new Map();
  }

  create({ patientId, providerId, startsAt, reason }) {
    for (const appt of this.byId.values()) {
      if (
        appt.providerId === providerId &&
        appt.startsAt === startsAt &&
        appt.status !== 'cancelled'
      ) {
        throw new SlotConflictError(providerId, startsAt);
      }
    }
    const appt = {
      id: randomUUID(),
      patientId,
      providerId,
      startsAt,
      reason: reason ?? null,
      status: 'booked',
      createdAt: new Date().toISOString(),
    };
    this.byId.set(appt.id, appt);
    this.version.set(appt.id, 1);
    return appt;
  }

  get(id) {
    return this.byId.get(id) ?? null;
  }

  etag(id) {
    return `"${this.version.get(id)}"`;
  }

  list({ patientId, status, limit, after }) {
    let rows = [...this.byId.values()].sort((a, b) =>
      a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : a.id.localeCompare(b.id)
    );
    if (patientId) rows = rows.filter((a) => a.patientId === patientId);
    if (status) rows = rows.filter((a) => a.status === status);
    if (after) {
      const idx = rows.findIndex((a) => a.id === after);
      rows = idx === -1 ? [] : rows.slice(idx + 1);
    }
    const page = rows.slice(0, limit);
    const nextAfter = rows.length > limit ? page[page.length - 1].id : null;
    return { page, nextAfter };
  }

  reschedule(id, startsAt) {
    const appt = this.byId.get(id);
    if (!appt) return null;
    appt.startsAt = startsAt;
    this.version.set(id, this.version.get(id) + 1);
    return appt;
  }

  cancel(id) {
    const appt = this.byId.get(id);
    if (!appt) return null;
    appt.status = 'cancelled';
    this.version.set(id, this.version.get(id) + 1);
    return appt;
  }
}

module.exports = { AppointmentStore, SlotConflictError };
