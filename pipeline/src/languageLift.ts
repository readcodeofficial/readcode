// Corpus evidence for the language fit table: how strongly each language co-occurs with each topic
// across the classified postings.
//
// For every posting, each topic's weight is shared across the posting's languages in proportion to their
// language weights. Summed over postings, that gives a topic × language mass. "lift" compares a language's
// share within one topic to its share across all topics: lift 2 means the language shows up twice as often
// around this topic as it does in general; lift 0.5 means half as often.
//
// Usage: node pipeline/src/languageLift.ts --taxonomy <taxonomy.json> --languages <languages.json> --out <lift.json> <weights.json>...
//   e.g. node pipeline/src/languageLift.ts --taxonomy pipeline/taxonomy/v0.1.0.json --languages pipeline/taxonomy/languages.json \
//          --out docs/language_lift.json postings/plans/weights/*.json

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const USAGE = "Usage: node pipeline/src/languageLift.ts --taxonomy <taxonomy.json> --languages <languages.json> --out <lift.json> <weights.json>...";
const { values, positionals } = parseArgs({
    options: { taxonomy: { type: "string" }, languages: { type: "string" }, out: { type: "string" } },
    allowPositionals: true,
});
if (!values.taxonomy || !values.languages || !values.out || positionals.length === 0) {
    console.error(USAGE);
    process.exit(1);
}

const labels: string[] = JSON.parse(readFileSync(values.taxonomy, "utf8")).labels;
const languages: string[] = JSON.parse(readFileSync(values.languages, "utf8")).languages;

const mass = new Map<string, number[]>(labels.map((l) => [l, languages.map(() => 0)]));
const overall = languages.map(() => 0);
let used = 0;

for (const file of positionals) {
    const raw = JSON.parse(readFileSync(file, "utf8")) as { weights: { label: string; weight: number }[]; languages?: Record<string, number> };
    const langWeights = languages.map((l) => raw.languages?.[l] ?? 0);
    const langTotal = langWeights.reduce((s, w) => s + w, 0);
    if (langTotal === 0) continue; // posting names no language: no evidence either way
    used++;
    for (const { label, weight } of raw.weights) {
        const row = mass.get(label);
        if (!row) continue;
        langWeights.forEach((lw, k) => {
            const m = (weight * lw) / langTotal;
            row[k] += m;
            overall[k] += m;
        });
    }
}

const overallTotal = overall.reduce((s, x) => s + x, 0);
const round = (x: number) => Math.round(x * 100) / 100;
const out = {
    postingsUsed: used,
    overallShare: Object.fromEntries(languages.map((l, k) => [l, round(overall[k] / overallTotal)])),
    topics: Object.fromEntries(
        labels.map((label) => {
            const row = mass.get(label)!;
            const total = row.reduce((s, x) => s + x, 0);
            return [
                label,
                {
                    mass: round(total),
                    lift: Object.fromEntries(
                        languages.map((l, k) => [l, total === 0 ? null : round(row[k] / total / (overall[k] / overallTotal || 1))]),
                    ),
                },
            ];
        }),
    ),
};
writeFileSync(values.out, JSON.stringify(out, null, 2) + "\n");
console.log(`lift for ${labels.length} topics from ${used} postings -> ${values.out}`);
