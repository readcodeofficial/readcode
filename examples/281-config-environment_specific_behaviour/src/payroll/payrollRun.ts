import type { Settings } from "../env/environment.ts";
import { createBankClient, type HttpTransport } from "./bank.ts";
import { payslipMailer, type Mailer } from "./notify.ts";

export interface Employee {
    id: string;
    email: string;
    iban: string;
    netCents: number;
}

export interface PayrollRun {
    period: string; // e.g. "2026-11"
    employees: Employee[];
    approvedBy?: string;
}

export interface RunResult {
    paid: { employeeId: string; transferId: string }[];
    failed: { employeeId: string; error: string }[];
}

export async function executePayroll(settings: Settings, http: HttpTransport, mailer: Mailer, run: PayrollRun): Promise<RunResult> {
    if (settings.requireApproval && !run.approvedBy) throw new Error(`payroll ${run.period} needs a second approver`);
    const bank = createBankClient(settings.bank, http);
    const notify = payslipMailer(settings, mailer);
    const result: RunResult = { paid: [], failed: [] };
    for (const e of run.employees) {
        try {
            const transferId = await bank.transfer(e.iban, e.netCents, `SALARY ${run.period} ${e.id}`);
            result.paid.push({ employeeId: e.id, transferId });
            await notify(e.email, run.period, e.netCents);
        } catch (err) {
            result.failed.push({ employeeId: e.id, error: (err as Error).message });
        }
    }
    return result;
}
