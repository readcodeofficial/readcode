'use strict';

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  let failed = false;

  async function worker() {
    while (!failed) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index], index);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

module.exports = { mapLimit };
