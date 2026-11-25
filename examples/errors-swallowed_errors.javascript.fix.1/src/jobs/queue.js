export function createQueue({ maxAttempts = 3 } = {}) {
  const jobs = [];
  let nextId = 1;

  return {
    enqueue(type, payload) {
      const job = { id: `j${nextId++}`, type, payload, status: "pending", attempts: 0, lastError: null };
      jobs.push(job);
      return job.id;
    },
    async take() {
      await Promise.resolve();
      const job = jobs.find((j) => j.status === "pending");
      if (!job) return null;
      job.status = "running";
      job.attempts += 1;
      return { id: job.id, type: job.type, payload: job.payload };
    },
    async ack(id) {
      await Promise.resolve();
      jobs.find((j) => j.id === id).status = "done";
    },
    async nack(id, reason) {
      await Promise.resolve();
      const job = jobs.find((j) => j.id === id);
      job.lastError = reason;
      job.status = job.attempts >= maxAttempts ? "dead" : "pending";
    },
    get(id) {
      return jobs.find((j) => j.id === id);
    },
    stats() {
      const out = { pending: 0, running: 0, done: 0, dead: 0 };
      for (const j of jobs) out[j.status] += 1;
      return out;
    },
  };
}
