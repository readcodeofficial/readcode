// Build plans from classifier weight files. One plan per weights file, written to --out under the same file name.
// Weights file format: {"weights": [{"label": "...", "weight": 0.0-1.0}, ...], "languages": {"Java": 1.0, ...}}
// (the classifier's output; "languages" is optional for files written before it existed).
//
// --fit <language_fit.json> keeps each topic to the posting's languages that suit it (see docs/LANGUAGE_FIT.md).
//
// Usage: node pipeline/src/plan.ts --taxonomy <taxonomy.json> [--fit <language_fit.json>] --out <dir> <weights.json>...
//   e.g. node pipeline/src/plan.ts --taxonomy pipeline/taxonomy/v0.1.0.json --fit pipeline/taxonomy/language_fit.json \n//          --out postings/plans postings/plans/weights/*.json

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { LanguageFit, Taxonomy, type Classification } from "../../shared/types.ts";
import { planFromClassification } from "./pipeline.ts";

const USAGE = "Usage: node pipeline/src/plan.ts --taxonomy <taxonomy.json> [--fit <language_fit.json>] --out <dir> <weights.json>...";
const { values, positionals } = parseArgs({
    options: { taxonomy: { type: "string" }, fit: { type: "string" }, out: { type: "string" } },
    allowPositionals: true,
});
if (!values.taxonomy || !values.out || positionals.length === 0) {
    console.error(USAGE);
    process.exit(1);
}

const taxonomy = Taxonomy.parse(JSON.parse(readFileSync(values.taxonomy, "utf8")));
const fit = values.fit ? LanguageFit.parse(JSON.parse(readFileSync(values.fit, "utf8"))) : undefined;
if (fit && fit.taxonomyVersion !== taxonomy.version) throw new Error(`fit table is for taxonomy ${fit.taxonomyVersion}, not ${taxonomy.version}`);
mkdirSync(values.out, { recursive: true });

for (const file of positionals) {
    const raw = JSON.parse(readFileSync(file, "utf8")) as { weights: { label: string; weight: number }[]; languages?: Record<string, number> };
    const byLabel = new Map<string, number>();
    for (const { label, weight } of raw.weights) {
        if (!taxonomy.labels.includes(label)) throw new Error(`${file}: unknown label ${label}`);
        byLabel.set(label, Math.min(1, Math.max(0, weight)));
    }
    const classification: Classification = {
        taxonomyVersion: taxonomy.version,
        weights: taxonomy.labels.map((l) => byLabel.get(l) ?? 0),
        languages: raw.languages ?? {},
    };
    const plan = planFromClassification(classification, taxonomy, fit);
    writeFileSync(path.join(values.out, path.basename(file)), JSON.stringify(plan, null, 2) + "\n");
}
console.log(`wrote ${positionals.length} plans to ${values.out}`);
