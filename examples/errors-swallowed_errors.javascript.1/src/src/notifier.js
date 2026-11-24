'use strict';

const { DispatchError } = require('./errors');

class PushNotifier {
  constructor({ fetchImpl = fetch, baseUrl, apiKey, timeoutMs = 2000 }) {
    this.fetch = fetchImpl;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  pushToDriver(driverId, payload) {
    return this.#push(`drivers/${driverId}`, payload);
  }

  pushToRider(riderId, payload) {
    return this.#push(`riders/${riderId}`, payload);
  }

  async #push(path, payload) {
    let res;
    try {
      res = await this.fetch(`${this.baseUrl}/v1/push/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new DispatchError(`push to ${path} failed`, { cause: err });
    }
    if (!res.ok) {
      throw new DispatchError(`push to ${path} returned ${res.status}`);
    }
  }
}

module.exports = { PushNotifier };
