import { renderPayslip, type Employee, type Payslip } from "./payslips.ts";

export interface EmailGateway {
    send(to: string, subject: string, body: string): Promise<void>;
}

export interface PrintQueue {
    // Queues a letter for the print-and-mail vendor; returns their tracking reference.
    enqueue(address: string, body: string, note: string): Promise<string>;
}

export interface Receipt {
    employeeId: string;
    channel: "email" | "post";
    reference: string;
}

export class PayslipDelivery {
    private readonly email: EmailGateway;
    private readonly print: PrintQueue;
    private readonly log: (line: string) => void;

    constructor(email: EmailGateway, print: PrintQueue, log: (line: string) => void = () => {}) {
        this.email = email;
        this.print = print;
        this.log = log;
    }

    // Email by default. Employees who opted out, or whose email bounces, get a printed letter instead:
    // everyone must receive a payslip by law.
    async deliver(employee: Employee, payslip: Payslip): Promise<Receipt> {
        if (employee.paperOnly || !employee.email) {
            return this.viaPost(employee, payslip, employee.paperOnly ? "opted out of email" : "no email on file");
        }
        try {
            return this.viaEmail(employee, employee.email, payslip);
        } catch (err) {
            this.log(`payslip email to ${employee.id} failed: ${(err as Error).message}`);
            return this.viaPost(employee, payslip, "email failed");
        }
    }

    private async viaEmail(employee: Employee, to: string, payslip: Payslip): Promise<Receipt> {
        await this.email.send(to, `Your payslip for ${payslip.period}`, renderPayslip(employee, payslip));
        return { employeeId: employee.id, channel: "email", reference: to };
    }

    private async viaPost(employee: Employee, payslip: Payslip, note: string): Promise<Receipt> {
        const reference = await this.print.enqueue(employee.postalAddress, renderPayslip(employee, payslip), note);
        return { employeeId: employee.id, channel: "post", reference };
    }
}
