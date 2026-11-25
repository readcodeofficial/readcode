import type { Settings } from "../env/environment.ts";

export interface HttpTransport {
    post(url: string, body: unknown): Promise<{ status: number; body: { transferId?: string; error?: string } }>;
}

export interface BankClient {
    transfer(iban: string, amountCents: number, reference: string): Promise<string>;
}

export function createBankClient(bank: Settings["bank"], http: HttpTransport): BankClient {
    return {
        async transfer(iban, amountCents, reference) {
            const res = await http.post(`${bank.baseUrl}/transfers`, { iban, amountCents, currency: "EUR", reference });
            if (res.status !== 201 || !res.body.transferId) throw new Error(`bank rejected transfer: ${res.body.error ?? res.status}`);
            return res.body.transferId;
        },
    };
}
