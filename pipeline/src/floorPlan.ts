// A plan that tops every taxonomy topic up to a minimum number of examples ("floor"), so topics that no
// posting asked for (or that the master plan hasn't reached yet) still have something to practise.
//
// For each topic below --min examples in the bank, the extra examples go, in order:
//   1. to languages the master plan already wants for that topic but doesn't have yet (best fit first), so
//      the job names match the master plan's;
//   2. then to the topic's best-fitting languages (fit >= MIN_FIT, 1.0 before 0.7), preferring languages the
//      topic doesn't have yet and that have fewer examples in the bank overall, for variety.
// Targets are absolute counts per (topic, language), like any plan, so generateBank.ts --plan <floor.json>
// prepares and assembles only the missing examples.
//
// Usage: node pipeline/src/floorPlan.ts --taxonomy <taxonomy.json> --fit <language_fit.json> --plan <master.json>
//          --examples <dir> --min <n> --out <floor.json>
//   e.g. node pipeline/src/floorPlan.ts --taxonomy pipeline/taxonomy/v0.1.0.json --fit pipeline/taxonomy/language_fit.json \
//          --plan postings/plans/master.json --examples examples --min 2 --out postings/plans/floor.json

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { LanguageFit, Plan, Taxonomy } from "../../shared/types.ts";

const MIN_FIT = 0.7; // same bar as planning (pipeline.ts MIN_LANGUAGE_FIT)
const USAGE =
    "Usage: node pipeline/src/floorPlan.ts --taxonomy <taxonomy.json> --fit <language_fit.json> --plan <master.json> --examples <dir> --min <n> --out <floor.json>";

const { values } = parseArgs({
    options: {
        taxonomy: { type: "string" },
        fit: { type: "string" },
        plan: { type: "string" },
        examples: { type: "string" },
        min: { type: "string" },
        out: { type: "string" },
    },
});
if (!values.taxonomy || !values.fit || !values.plan || !values.examples || !values.min || !values.out) {
    console.error(USAGE);
    process.exit(1);
}
const taxonomy = Taxonomy.parse(JSON.parse(readFileSync(values.taxonomy, "utf8")));
const fit = LanguageFit.parse(JSON.parse(readFileSync(values.fit, "utf8")));
const master = Plan.parse(JSON.parse(readFileSync(values.plan, "utf8")));
const min = Number(values.min);

// What the bank has: per (topic, language), per topic, per language.
const key = (label: string, language: string) => `${label}|${language}`;
const havePair = new Map<string, number>();
const haveTopic = new Map<string, number>();
const haveLanguage = new Map<string, number>();
for (const entry of readdirSync(values.examples, { withFileTypes: true })) {
    const pub = path.join(values.examples, entry.name, "public.json");
    if (!entry.isDirectory() || !existsSync(pub)) continue;
    const { concepts, language } = JSON.parse(readFileSync(pub, "utf8")) as { concepts: string[]; language: string };
    havePair.set(key(concepts[0], language), (havePair.get(key(concepts[0], language)) ?? 0) + 1);
    haveTopic.set(concepts[0], (haveTopic.get(concepts[0]) ?? 0) + 1);
    haveLanguage.set(language, (haveLanguage.get(language) ?? 0) + 1);
}

const targets: Plan["targets"] = [];
const added = new Map<string, number>(); // per (topic, language), examples this floor adds
const report: string[] = [];
for (const label of taxonomy.labels) {
    let need = min - (haveTopic.get(label) ?? 0);
    if (need <= 0) continue;
    const weights = fit.topics[label]?.weights ?? {};
    const give = (language: string) => {
        added.set(key(label, language), (added.get(key(label, language)) ?? 0) + 1);
        haveLanguage.set(language, (haveLanguage.get(language) ?? 0) + 1);
        need--;
    };

    // 1. the master plan's own shortfall for this topic, best fit first
    const planned = master.targets
        .filter((t) => t.label === label && (weights[t.language] ?? 0) >= MIN_FIT)
        .map((t) => ({ language: t.language, short: t.count - (havePair.get(key(label, t.language)) ?? 0) }))
        .filter((t) => t.short > 0)
        .sort((a, b) => (weights[b.language] ?? 0) - (weights[a.language] ?? 0) || b.short - a.short);
    for (const t of planned) for (let i = 0; i < t.short && need > 0; i++) give(t.language);

    // 2. best-fitting languages, one per pass, new-to-the-topic and less-used languages first
    while (need > 0) {
        const candidates = fit.languages
            .filter((l) => (weights[l] ?? 0) >= MIN_FIT)
            .sort(
                (a, b) =>
                    (weights[b] ?? 0) - (weights[a] ?? 0) ||
                    (havePair.get(key(label, a)) ?? 0) + (added.get(key(label, a)) ?? 0) - ((havePair.get(key(label, b)) ?? 0) + (added.get(key(label, b)) ?? 0)) ||
                    (haveLanguage.get(a) ?? 0) - (haveLanguage.get(b) ?? 0) ||
                    fit.languages.indexOf(a) - fit.languages.indexOf(b),
            );
        if (candidates.length === 0) throw new Error(`${label}: no language with fit >= ${MIN_FIT}`);
        give(candidates[0]);
    }
    report.push(`${label}: ${[...added].filter(([k]) => k.startsWith(label + "|")).map(([k, n]) => `${k.split("|")[1]}+${n}`).join(", ")}`);
}

for (const [k, n] of added) {
    const [label, language] = k.split("|");
    targets.push({ label, language, count: (havePair.get(k) ?? 0) + n });
}
const floor: Plan = { taxonomyVersion: taxonomy.version, targets };
writeFileSync(values.out, JSON.stringify(Plan.parse(floor), null, 2) + "\n");
const total = [...added.values()].reduce((s, n) => s + n, 0);
console.log(report.join("\n"));
console.log(`floor ${min}: ${report.length} topics below it, ${total} examples to add -> ${values.out}`);
