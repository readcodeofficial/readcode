export interface Employee {
    id: string;
    name: string;
    annualSalaryCents: number;
    taxRate: number; // withholding rate from the employee's tax code, e.g. 0.22
    pensionRate: number; // employee pension contribution, e.g. 0.05
    email?: string;
    postalAddress: string;
    paperOnly: boolean; // opted out of electronic payslips
}

export interface Payslip {
    employeeId: string;
    period: string; // "2026-11"
    grossCents: number;
    taxCents: number;
    pensionCents: number;
    netCents: number;
}

export function buildPayslip(e: Employee, period: string): Payslip {
    const grossCents = Math.round(e.annualSalaryCents / 12);
    const pensionCents = Math.round(grossCents * e.pensionRate);
    // pension contributions are taken before tax
    const taxCents = Math.round((grossCents - pensionCents) * e.taxRate);
    return { employeeId: e.id, period, grossCents, taxCents, pensionCents, netCents: grossCents - pensionCents - taxCents };
}

export function renderPayslip(e: Employee, p: Payslip): string {
    const money = (c: number) => (c / 100).toFixed(2);
    return [
        `Payslip ${p.period} for ${e.name}`,
        `Gross   ${money(p.grossCents)}`,
        `Pension -${money(p.pensionCents)}`,
        `Tax     -${money(p.taxCents)}`,
        `Net     ${money(p.netCents)}`,
    ].join("\n");
}
