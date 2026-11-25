export class TimeoutError extends Error {
  constructor(ms) {
    super(`timed out after ${ms}ms`);
    this.name = "TimeoutError";
    this.timeoutMs = ms;
  }
}

export async function callWithTimeout(fn, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new TimeoutError(ms)), ms);
  try {
    return await fn();
  } finally {
    clearTimeout(timer);
  }
}
