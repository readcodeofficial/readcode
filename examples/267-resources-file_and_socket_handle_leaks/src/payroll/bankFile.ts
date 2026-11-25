export interface Payment {
    employeeId: string;
    name: string;
    iban: string;
    amountCents: number;
}

export interface PayrollRun {
    employerId: string;
    runId: string;
    payDate: string; // YYYY-MM-DD
    payments: Payment[];
}

const IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;

export function validateRun(run: PayrollRun): string[] {
    const problems: string[] = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(run.payDate)) problems.push("payDate must be YYYY-MM-DD");
    if (run.payments.length === 0) problems.push("run has no payments");
    for (const p of run.payments) {
        if (!IBAN.test(p.iban)) problems.push(`${p.employeeId}: IBAN is invalid`);
        if (!Number.isInteger(p.amountCents) || p.amountCents <= 0) problems.push(`${p.employeeId}: amount must be positive cents`);
    }
    return problems;
}

const field = (s: string) => s.replaceAll("|", " ").trim();

// The bank's pipe-delimited bulk credit format: header, one P line per payment, trailer with totals.
export function renderPaymentFile(run: PayrollRun): string[] {
    const total = run.payments.reduce((sum, p) => sum + p.amountCents, 0);
    return [
        `H|${field(run.employerId)}|${field(run.runId)}|${run.payDate.replaceAll("-", "")}`,
        ...run.payments.map((p) => `P|${field(p.employeeId)}|${p.iban}|${p.amountCents}|${field(p.name)}`),
        `T|${run.payments.length}|${total}`,
    ];
}
