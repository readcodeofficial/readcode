// Render the language fit table (pipeline/taxonomy/language_fit.json) as docs/LANGUAGE_FIT.md: a heat table per
// area, then each topic's rationale, sources and corpus lift. Regenerate after editing the weights.
//
// Usage: node pipeline/src/languageFitDoc.ts --fit <language_fit.json> --lift <language_lift.json> --out <LANGUAGE_FIT.md>
//   e.g. node pipeline/src/languageFitDoc.ts --fit pipeline/taxonomy/language_fit.json --lift docs/language_lift.json --out docs/LANGUAGE_FIT.md

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { LanguageFit } from "../../shared/types.ts";

const USAGE = "Usage: node pipeline/src/languageFitDoc.ts --fit <language_fit.json> --lift <language_lift.json> --out <LANGUAGE_FIT.md>";
const { values } = parseArgs({ options: { fit: { type: "string" }, lift: { type: "string" }, out: { type: "string" } } });
if (!values.fit || !values.lift || !values.out) {
    console.error(USAGE);
    process.exit(1);
}

const fit = LanguageFit.parse(JSON.parse(readFileSync(values.fit, "utf8")));
const lift = JSON.parse(readFileSync(values.lift, "utf8")) as {
    postingsUsed: number;
    topics: Record<string, { mass: number; lift: Record<string, number | null> }>;
};
const langs = fit.languages;
const SHORT: Record<string, string> = { TypeScript: "TS", JavaScript: "JS", Java: "Java", Kotlin: "Kt", Go: "Go", Python: "Py", "C#": "C#", Ruby: "Rb", Rust: "Rs", C: "C", "C++": "C++", Scala: "Sc", PHP: "PHP" };
const cell = (w: number) => (w >= 1 ? "**1**" : w === 0 ? "·" : String(w).replace(/^0/, ""));
const topicName = (label: string) => label.split(".").slice(2).join(".");
const areaOf = (label: string) => label.split(".")[1];

const lines: string[] = [
    "# Language fit per topic",
    "",
    "Which languages suit an exercise on each taxonomy topic, in backend work. Planning (`planFromClassification` in",
    "`pipeline/src/pipeline.ts`) only gives a topic the posting's languages with fit ≥ 0.7 (common or mainstream), weighting each by",
    "posting language weight × fit; if none fits, the topic uses its best-fitting language.",
    "",
    "Generated from `pipeline/taxonomy/language_fit.json` by `pipeline/src/languageFitDoc.ts` — edit the JSON, then regenerate.",
    "",
    "**Scale:** 1 = a mainstream home of the topic (routine, well-known libraries/runtime features/bug classes) ·",
    ".7 = common · .4 = plausible but not where most people meet it · .1 = rare, would look contrived · · = doesn't arise.",
    "",
    "**Evidence:** each topic lists web sources (library/framework docs, language references, engineering articles) and",
    `the corpus lift from our ${lift.postingsUsed} classified postings that name languages (\`docs/language_lift.json\`,`,
    "`pipeline/src/languageLift.ts`): how much more (>1) or less (<1) often a language co-occurs with the topic than",
    "its baseline share. Lift is sparse for C#, PHP, C, Scala and Kotlin, so the web evidence sets the scores and lift",
    "is a cross-check.",
    "",
];

const areas = [...new Set(Object.keys(fit.topics).map(areaOf))];
for (const area of areas) {
    const labels = Object.keys(fit.topics).filter((l) => areaOf(l) === area);
    lines.push(`## ${area}`, "");
    lines.push(`| topic | ${langs.map((l) => SHORT[l] ?? l).join(" | ")} |`, `|---|${langs.map(() => ":-:").join("|")}|`);
    for (const label of labels) {
        lines.push(`| ${topicName(label)} | ${langs.map((l) => cell(fit.topics[label].weights[l] ?? 0)).join(" | ")} |`);
    }
    lines.push("");
    for (const label of labels) {
        const t = fit.topics[label];
        const l = lift.topics[label];
        const strong = l
            ? Object.entries(l.lift)
                  .filter(([, v]) => v !== null && v >= 1.3)
                  .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                  .map(([lang, v]) => `${lang} ×${v}`)
            : [];
        lines.push(`### ${topicName(label)}`, "", t.rationale, "");
        for (const s of t.sources) lines.push(`- <${s.url}> — ${s.supports}`);
        lines.push(`- Corpus lift: ${strong.length ? strong.join(", ") : "no language above ×1.3"}${l ? ` (topic mass ${l.mass})` : ""}`, "");
    }
}

writeFileSync(values.out, lines.join("\n"));
console.log(`wrote ${values.out} (${Object.keys(fit.topics).length} topics)`);
