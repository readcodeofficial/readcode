// Split a whole-cent amount across parties in proportion to their weights.
export function allocate(amountCents: number, weights: number[]): number[] {
    if (!Number.isInteger(amountCents) || amountCents < 0) {
        throw new Error("amountCents must be a non-negative integer");
    }
    if (weights.length === 0) throw new Error("at least one weight is required");
    if (weights.some((w) => !Number.isFinite(w) || w < 0)) throw new Error("weights must be non-negative numbers");

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) throw new Error("weights must not all be zero");

    return weights.map((w) => Math.round((amountCents * w) / totalWeight));
}
