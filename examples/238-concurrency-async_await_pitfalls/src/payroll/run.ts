import type { PayslipDelivery, Receipt } from "./delivery.ts";
import { buildPayslip, type Employee } from "./payslips.ts";

export interface PayrollRunSummary {
    period: string;
    totalNetCents: number;
    receipts: Receipt[];
    undelivered: { employeeId: string; error: string }[];
}

// Builds and delivers every payslip for the period. One failed delivery doesn't stop the run;
// it is listed so HR can follow up by hand.
export async function runPayroll(employees: Employee[], period: string, delivery: PayslipDelivery): Promise<PayrollRunSummary> {
    const payslips = employees.map((e) => buildPayslip(e, period));
    const settled = await Promise.allSettled(employees.map((e, i) => delivery.deliver(e, payslips[i])));

    const summary: PayrollRunSummary = { period, totalNetCents: 0, receipts: [], undelivered: [] };
    settled.forEach((result, i) => {
        summary.totalNetCents += payslips[i].netCents;
        if (result.status === "fulfilled") summary.receipts.push(result.value);
        else summary.undelivered.push({ employeeId: employees[i].id, error: (result.reason as Error).message });
    });
    return summary;
}
