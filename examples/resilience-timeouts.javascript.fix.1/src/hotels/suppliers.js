export function instantSupplier(name, offers) {
  return {
    name,
    calls: 0,
    async search() {
      this.calls += 1;
      return offers;
    },
  };
}

export function failingSupplier(name, message = "502 bad gateway") {
  return {
    name,
    async search() {
      throw new Error(message);
    },
  };
}

export function hangingSupplier(name) {
  const supplier = {
    name,
    started: false,
    aborted: false,
    search(_query, signal) {
      supplier.started = true;
      return new Promise((_resolve, reject) => {
        if (!signal) return;
        const onAbort = () => {
          supplier.aborted = true;
          reject(signal.reason);
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      });
    },
  };
  return supplier;
}
