import { callWithTimeout, TimeoutError } from "./timeout.js";
import { rankOffers } from "./rank.js";

export async function searchHotels(suppliers, query, { timeoutMs = 1500 } = {}) {
  const settled = await Promise.allSettled(
    suppliers.map((supplier) => callWithTimeout((signal) => supplier.search(query, signal), timeoutMs)),
  );

  const offers = [];
  const skipped = [];
  settled.forEach((outcome, i) => {
    const name = suppliers[i].name;
    if (outcome.status === "fulfilled") {
      for (const offer of outcome.value) offers.push({ ...offer, supplier: name });
    } else {
      const reason = outcome.reason instanceof TimeoutError ? "timeout" : "error";
      skipped.push({ supplier: name, reason });
    }
  });

  return { offers: rankOffers(offers, query), skipped };
}
