export interface Invoice {
  id: string;
  accountId: string;
  amountCents: number;
  status: "open" | "paid" | "void";
}

export interface Payment {
  id: string;
  accountId: string;
  invoiceId: string;
  amountCents: number;
  refundedCents: number;
}

export interface InvoiceRepo {
  findByIdForAccount(id: string, accountId: string): Promise<Invoice | null>;
  listForAccount(accountId: string, limit: number): Promise<Invoice[]>;
}

export interface PaymentRepo {
  findById(id: string): Promise<Payment | null>;
  findByIdForAccount(id: string, accountId: string): Promise<Payment | null>;
  recordRefund(id: string, amountCents: number): Promise<Payment>;
}
