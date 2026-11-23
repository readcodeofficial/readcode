// The topic taxonomy that examples and plans are labelled with (pipeline/taxonomy/).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { EXAMPLES_ROOT } from "./examples";

export const TAXONOMY_VERSION = "0.1.0";

export const loadTaxonomy = cache(async (): Promise<{ version: string; labels: string[] }> => {
    const file = path.join(/*turbopackIgnore: true*/ EXAMPLES_ROOT, "pipeline", "taxonomy", `v${TAXONOMY_VERSION}.json`);
    return JSON.parse(await readFile(file, "utf8"));
});
