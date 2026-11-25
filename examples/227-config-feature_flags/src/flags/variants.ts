import { fnv1a } from "./hash.ts";

export interface Variant {
    name: string;
    weight: number; // relative; weights don't need to add up to 100
}

export interface Experiment {
    key: string;
    variants: Variant[];
}

// Deterministic A/B(/n) assignment: the same user always lands in the same variant,
// and the share of users per variant follows the weights.
export function assignVariant(experiment: Experiment, userId: string): string {
    const total = experiment.variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0);
    if (total <= 0) throw new Error(`Experiment ${experiment.key} has no weighted variants`);

    // 10,000 slots give 0.01% resolution; the experiment key salts the hash so
    // experiments don't all split users the same way
    const point = ((fnv1a(`${experiment.key}:variant:${userId}`) % 10_000) / 10_000) * total;
    let cumulative = 0;
    for (const variant of experiment.variants) {
        cumulative += Math.max(0, variant.weight);
        if (point < cumulative) return variant.name;
    }
    return experiment.variants[experiment.variants.length - 1].name;
}
