import { renderPaymentFile, validateRun, type PayrollRun } from "./bankFile.ts";
import type { RemoteFile, SftpConnector, UploadTarget } from "./sftp.ts";

export interface UploadResult {
    path: string;
    lines: number;
}

// Uploads one payroll run to the bank's inbound folder. The file is written under a .part name and
// renamed when complete, because the bank picks up every *.pay file it sees.
export async function uploadPaymentFile(connector: SftpConnector, target: UploadTarget, run: PayrollRun): Promise<UploadResult> {
    const problems = validateRun(run);
    if (problems.length > 0) throw new Error(`payroll run ${run.runId} is invalid: ${problems.join("; ")}`);

    const lines = renderPaymentFile(run);
    const finalPath = `${target.dir}/${run.employerId}-${run.runId}.pay`;
    const partPath = `${finalPath}.part`;

    const session = await connector.connect(target.host, target.user);
    let file: RemoteFile | null = null;
    try {
        file = await session.openWrite(partPath);
        for (const line of lines) await file.write(`${line}\n`);
        await file.close();
        file = null;
        await session.rename(partPath, finalPath);
        return { path: finalPath, lines: lines.length };
    } finally {
        if (file) await file.close();
        await session.close();
    }
}
