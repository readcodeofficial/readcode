import type { LabResultInput, LabResultService } from "./results.ts";

export interface FeedReport {
    recorded: number;
    critical: string[];
    rejected: { accession: string; error: string }[];
}

// Imports a batch of results from an analyzer feed, several at a time.
export async function importFeed(service: LabResultService, batch: LabResultInput[], concurrency: number): Promise<FeedReport> {
    const report: FeedReport = { recorded: 0, critical: [], rejected: [] };
    let next = 0;

    async function worker(): Promise<void> {
        while (next < batch.length) {
            const result = batch[next++];
            try {
                const flag = await service.record(result, "feed:analyzer");
                report.recorded++;
                if (flag === "critical") report.critical.push(result.accession);
            } catch (err) {
                report.rejected.push({ accession: result.accession, error: (err as Error).message });
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, () => worker()));
    return report;
}
