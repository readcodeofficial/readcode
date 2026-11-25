import type { PayrollRun } from "./bankFile.ts";
import type { SftpConnector, UploadTarget } from "./sftp.ts";
import { uploadPaymentFile } from "./uploader.ts";

export interface BatchReport {
    uploaded: string[];
    failed: { runId: string; error: string }[];
}

// Nightly job: uploads every approved payroll run, one at a time. A failed run is reported and
// retried by the next night's job; it must not stop the other employers from being paid.
export async function uploadApprovedRuns(connector: SftpConnector, target: UploadTarget, runs: PayrollRun[]): Promise<BatchReport> {
    const report: BatchReport = { uploaded: [], failed: [] };
    for (const run of runs) {
        try {
            const result = await uploadPaymentFile(connector, target, run);
            report.uploaded.push(result.path);
        } catch (err) {
            report.failed.push({ runId: run.runId, error: (err as Error).message });
        }
    }
    return report;
}
