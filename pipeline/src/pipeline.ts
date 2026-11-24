// The Pipeline
// pre-step:
// have an example bank with discrete counts (concepts covered from example: +1)
// steps:
// 1. take job posting as input
// 2. classify weights for the job posting
// 3. coverage test, proceed if not covered
// 4. rank concepts by shortfall
// 5. choose highest shortfall concept to create an example with
// 6. Anchor file is chosen from out of our open-source repo pool that scores best with the shortfall concept. The LLM picks supporting files that the file needs. score takes into account file reuse count (use example bank)
// 7. scrape the files needed to create the example
// 8. self-contain the example (no function references to files not selected)
// 9. inject bugs if relevant
// 10. Verify through compiling
// 11. generate a rubric
// 12. human review
// 13. add to the bank and update the counts.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import { LanguageFit, LanguageList, Plan, Taxonomy, type Classification } from "../../shared/types.ts";
import { classify } from "./classifier.ts";
import { generateExample, writeExample } from "./exampleGenerator.ts";

const EXAMPLES_PER_POSTING = 20;
const MIN_PER_TOPIC = 2;
const SHARE_POWER = 2;
const DEFAULT_LANGUAGE = "Python"; // when a posting names no language: the most common interview language
const MIN_LANGUAGE_FIT = 0.7; // only "common" (0.7) or "mainstream" (1.0) languages get a topic (docs/LANGUAGE_FIT.md)


// use a job description file to create a plan file
async function plan(jobDescription: string, taxonomy: Taxonomy, languages: LanguageList, fit?: LanguageFit): Promise<Plan> {
    // 1. classify
    const classification = await classify(jobDescription, taxonomy, languages);
    return planFromClassification(classification, taxonomy, fit);
}

// steps 2-6: turn a classification (weights per label) into example counts
export function planFromClassification(classification: Classification, taxonomy: Taxonomy, fit?: LanguageFit): Plan {
    // 1. rank concepts
    const ranked = taxonomy.labels
        .map((label, i) => ({ label, weight: classification.weights[i], i }))
        .filter((r) => r.weight > 0)
        .sort((a, b) => b.weight - a.weight || a.i - b.i);

    // 2. Keep only the topics that will get examples, and split the examples across them by squared weight
    //    (0.6 is worth four times 0.3, not twice). If any topic would get fewer than MIN_PER_TOPIC, drop the
    //    weakest and split again (like an electoral threshold).
    const shares = (rs: typeof ranked) => normalize(rs.map((r) => r.weight ** SHARE_POWER));
    let chosen = ranked.slice(0, Math.floor(EXAMPLES_PER_POSTING / MIN_PER_TOPIC));
    let counts = largestRemainder(EXAMPLES_PER_POSTING, shares(chosen));
    while (chosen.length > 1 && Math.min(...counts) < MIN_PER_TOPIC) {
        chosen = chosen.slice(0, -1);
        counts = largestRemainder(EXAMPLES_PER_POSTING, shares(chosen));
    }

    // 3. Split each topic's examples across the posting's languages that suit the topic: score = the posting's
    //    language weight × the topic's language fit, ignoring languages with fit < MIN_LANGUAGE_FIT (no N+1-query
    //    exercises in C). If none of the posting's languages suits the topic, the topic uses its best-fitting
    //    language overall. No languages named -> DEFAULT_LANGUAGE. Without a fit table every language fits.
    const langs = Object.entries(classification.languages).filter(([, w]) => w > 0);
    const postingLanguages: [string, number][] = langs.length ? langs : [[DEFAULT_LANGUAGE, 1]];

    return {
        taxonomyVersion: taxonomy.version,
        targets: chosen.flatMap((r, j) => {
            const fitOf = (language: string) => (fit ? fit.topics[r.label]?.weights[language] ?? 0 : 1);
            let scored = postingLanguages
                .map(([language, w]) => ({ language, score: w * fitOf(language) }))
                .filter((s) => fitOf(s.language) >= MIN_LANGUAGE_FIT);
            if (scored.length === 0) scored = [{ language: bestLanguage(r.label, fit!), score: 1 }];
            scored.sort((a, b) => b.score - a.score || a.language.localeCompare(b.language));
            const split = largestRemainder(counts[j], normalize(scored.map((s) => s.score)));
            return scored.map((s, k) => ({ label: r.label, language: s.language, count: split[k] })).filter((t) => t.count > 0);
        }),
    };
}

// The topic's highest-fit language; ties go to the more common interview language (DEFAULT_LANGUAGE first,
// then the fit table's language order).
function bestLanguage(label: string, fit: LanguageFit): string {
    const weights = fit.topics[label]?.weights ?? {};
    const order = [DEFAULT_LANGUAGE, ...fit.languages.filter((l) => l !== DEFAULT_LANGUAGE)];
    return order.reduce((best, l) => ((weights[l] ?? 0) > (weights[best] ?? 0) ? l : best), order[0]);
}

function normalize(values: number[]): number[] {
    const total = values.reduce((s, x) => s + x, 0);
    return values.map((x) => x / total); // sums to 1
}

// Split `total` items by `shares` (summing to 1) into whole numbers: round each ideal amount down, then
// give the leftover items to the largest fractional parts (largest remainder / Hamilton method).
// e.g. ideal = 2.8, 3.7, 3.5 -> floors 2, 3, 3 -> leftover 2 -> 3, 4, 3
function largestRemainder(total: number, shares: number[]): number[] {
    const ideal = shares.map((s) => s * total);
    const counts = ideal.map(Math.floor);
    const leftover = total - counts.reduce((s, c) => s + c, 0);
    ideal
        .map((q, i) => ({ i, remainder: q - Math.floor(q) }))
        .sort((a, b) => b.remainder - a.remainder || a.i - b.i)
        .slice(0, leftover)
        .forEach(({ i }) => counts[i]++);
    return counts;
}

// exampleOut: folder to write the generated example to. Without it, only report the topic.
async function pipeline(plan: Plan, taxonomy: Taxonomy, exampleOut?: string) {
    // TODO: count bank, compute shortfall; for now take the top target
    const topic = plan.targets[0].label;
    console.log(`going to create an example for ${topic}`);
    if (!exampleOut) return;

    const example = await generateExample(topic, taxonomy);
    await writeExample(example, exampleOut);
    console.log(`Example written to ${exampleOut}`);
}

// Every mode needs --taxonomy <taxonomy.json>; classifying (standard, --create_plan) also needs --languages <languages.json>,
// and takes --fit <language_fit.json> to keep each topic to languages that suit it.
// standard:     node pipeline/src/pipeline.ts <job_description_file.txt>                          plan → pipeline
// plan only:    node pipeline/src/pipeline.ts <job_description_file.txt> --create_plan <out.json>  plan → write file
// reuse a plan: node pipeline/src/pipeline.ts --use_plan <plan.json>                               read file → pipeline
// add --example_out <dir> to standard or --use_plan to generate the example into <dir> (public.json, key.json, src/)
async function main() {
    const { values, positionals } = parseArgs({
        options: { taxonomy:    { type: "string" },
                   languages:   { type: "string" },
                   fit:         { type: "string" },
                   create_plan: { type: "string" },
                   use_plan:    { type: "string" },
                   example_out: { type: "string" } },
        allowPositionals: true,
    });
    const usage = "Usage: node pipeline/src/pipeline.ts --taxonomy <taxonomy.json> (--languages <languages.json> [--fit <language_fit.json>] <job_description_file.txt> [--create_plan <out.json>] | --use_plan <plan.json>) [--example_out <dir>]";
    if (!values.taxonomy) {
        console.error(usage);
        process.exit(1);
    }
    const taxonomy = Taxonomy.parse(JSON.parse(await readFile(values.taxonomy, "utf8")));

    if (values.create_plan && values.use_plan) {
        console.error("--create_plan and --use_plan can't be used together.\n" + usage);
        process.exit(1);
    }
    if (values.create_plan && values.example_out) {
        console.error("--example_out does nothing with --create_plan (no pipeline run).\n" + usage);
        process.exit(1);
    }

    // --use_plan: skip planning, run the pipeline on a saved plan
    if (values.use_plan) {
        const saved = Plan.parse(JSON.parse(await readFile(values.use_plan, "utf8")));
        await pipeline(saved, taxonomy, values.example_out);
        return;
    }

    const jobDescriptionFile = positionals[0];
    if (!jobDescriptionFile || !values.languages) {
        console.error(usage);
        process.exit(1);
    }
    const description = await readFile(jobDescriptionFile, "utf8");
    const languages = LanguageList.parse(JSON.parse(await readFile(values.languages, "utf8")));
    const fit = values.fit ? LanguageFit.parse(JSON.parse(await readFile(values.fit, "utf8"))) : undefined;
    const result = await plan(description, taxonomy, languages, fit);

    // --create_plan: save the plan and stop
    if (values.create_plan) {
        await writeFile(values.create_plan, JSON.stringify(result, null, 2) + "\n");
        console.log(`Plan written to ${values.create_plan}`);
        return;
    }

    // standard: plan, then pipeline
    await pipeline(result, taxonomy, values.example_out);
}

// run only when executed directly, not when imported
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
