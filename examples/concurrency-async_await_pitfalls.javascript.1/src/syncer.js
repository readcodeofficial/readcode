'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { setTimeout: sleep } = require('node:timers/promises');
const { mapLimit } = require('./pool');

const backoffMs = (attempt) => Math.min(2000, 100 * 2 ** (attempt - 1));

class FolderSyncer {
  constructor({ root, store, concurrency = 4, maxAttempts = 3, uploadTimeoutMs = 15000, intervalMs = 30000, logger = console }) {
    this.root = root;
    this.store = store;
    this.concurrency = concurrency;
    this.maxAttempts = maxAttempts;
    this.uploadTimeoutMs = uploadTimeoutMs;
    this.intervalMs = intervalMs;
    this.logger = logger;
  }

  async run(signal) {
    while (!signal.aborted) {
      try {
        await this.sync();
      } catch (err) {
        this.logger.error(`sync cycle failed: ${err.message}`);
      }
      try {
        await sleep(this.intervalMs, undefined, { signal });
      } catch (err) {
        if (err.name !== 'AbortError') throw err;
      }
    }
  }

  async sync() {
    const startedAt = Date.now();
    const local = await this.#scan();
    const remote = await this.store.listHashes();

    const pending = local.filter((file) => remote.get(file.rel) !== file.hash);
    const outcomes = await mapLimit(pending, this.concurrency, (file) => this.#uploadOne(file));
    const failed = outcomes.filter((o) => o.status === 'failed');

    if (failed.length === 0) {
      await this.store.commitManifest(local.map((file) => ({ rel: file.rel, hash: file.hash })));
    }

    const present = new Set(local.map((file) => file.rel));
    const stale = [...remote.keys()].filter((rel) => !present.has(rel));
    const removals = await Promise.allSettled(stale.map((rel) => this.store.remove(rel)));
    const removalFailures = removals.filter((r) => r.status === 'rejected').length;

    const summary = {
      uploaded: outcomes.length - failed.length,
      failed: failed.map((o) => ({ rel: o.rel, reason: o.reason })),
      removed: stale.length - removalFailures,
      removalFailures,
      durationMs: Date.now() - startedAt,
    };

    this.store.recordSync(summary).catch((err) => {
      this.logger.warn(`could not record sync summary: ${err.message}`);
    });

    return summary;
  }

  async #scan() {
    const files = [];
    const walk = async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else if (entry.isFile()) {
          files.push({ rel: path.relative(this.root, full).split(path.sep).join('/') });
        }
      }
    };
    await walk(this.root);

    return mapLimit(files, this.concurrency, async (file) => {
      const body = await fs.readFile(path.join(this.root, file.rel));
      return { ...file, hash: crypto.createHash('sha256').update(body).digest('hex') };
    });
  }

  async #uploadOne(file) {
    let body;
    try {
      body = await fs.readFile(path.join(this.root, file.rel));
    } catch (err) {
      return { rel: file.rel, status: 'failed', reason: `unreadable: ${err.code ?? err.message}` };
    }

    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.uploadTimeoutMs);
      try {
        await this.store.put(file.rel, body, { hash: file.hash, signal: controller.signal });
        return { rel: file.rel, status: 'uploaded', attempts: attempt };
      } catch (err) {
        lastError = err;
        this.logger.warn(`upload ${file.rel} attempt ${attempt} failed: ${err.message}`);
      } finally {
        clearTimeout(timer);
      }
      if (attempt < this.maxAttempts) await sleep(backoffMs(attempt));
    }
    const reason = lastError.name === 'AbortError' ? 'timeout' : lastError.message;
    return { rel: file.rel, status: 'failed', reason };
  }
}

module.exports = { FolderSyncer };
