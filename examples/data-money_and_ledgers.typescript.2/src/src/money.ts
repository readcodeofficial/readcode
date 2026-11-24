export type Cents = number;

export function assertCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative integer number of cents, got ${value}`);
  }
}

export function formatCents(value: Cents, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value / 100);
}

/**
 * Splits `total` across `weights` so the parts always sum to `total`
 * (largest remainder method, ties broken by position).
 */
export function allocate(total: Cents, weights: number[]): Cents[] {
  assertCents(total, "total");
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0 || sum <= 0) {
    throw new RangeError("weights must contain a positive value");
  }

  const shares = weights.map((w) => Math.floor((total * w) / sum));
  let remainder = total - shares.reduce((a, b) => a + b, 0);

  const byFraction = weights
    .map((w, index) => ({ index, fraction: (total * w) % sum }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let k = 0; remainder > 0; k++, remainder--) {
    shares[byFraction[k].index] += 1;
  }
  return shares;
}
