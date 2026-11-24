'use strict';

class NoDriversAvailableError extends Error {
  constructor(tripId) {
    super(`no drivers available for trip ${tripId}`);
    this.name = 'NoDriversAvailableError';
    this.tripId = tripId;
  }
}

class TripStateError extends Error {
  constructor(tripId, status) {
    super(`trip ${tripId} is ${status}`);
    this.name = 'TripStateError';
    this.tripId = tripId;
    this.status = status;
  }
}

class DispatchError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'DispatchError';
  }
}

module.exports = { NoDriversAvailableError, TripStateError, DispatchError };
