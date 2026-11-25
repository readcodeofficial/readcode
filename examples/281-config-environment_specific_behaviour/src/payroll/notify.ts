import type { Settings } from "../env/environment.ts";

export interface Mailer {
    send(to: string, subject: string, body: string): Promise<void>;
}

// Outside production, mail goes to the redirect inbox, with the real recipient kept in the subject.
export function payslipMailer(settings: Settings, mailer: Mailer) {
    return async (employeeEmail: string, period: string, netCents: number): Promise<void> => {
        const subject = `Your payslip for ${period} is ready`;
        const body = `Net pay: EUR ${(netCents / 100).toFixed(2)}. Log in to the HR portal to view it.`;
        if (settings.emailRedirect) {
            await mailer.send(settings.emailRedirect, `[${settings.name} → ${employeeEmail}] ${subject}`, body);
        } else {
            await mailer.send(employeeEmail, subject, body);
        }
    };
}
