import { Router } from "express";
import { requireRole, requireScope } from "./auth";
import { InvoiceRepo, PaymentRepo } from "./repo";

export function billingRoutes(invoices: InvoiceRepo, payments: PaymentRepo): Router {
  const router = Router();

  router.get("/invoices", requireScope("invoices:read"), async (req, res) => {
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const items = await invoices.listForAccount(req.auth!.accountId, limit);
    res.json({ items });
  });

  router.get("/invoices/:invoiceId", requireScope("invoices:read"), async (req, res) => {
    const invoice = await invoices.findByIdForAccount(req.params.invoiceId, req.auth!.accountId);
    if (!invoice) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json(invoice);
  });

  router.get("/payments/:paymentId", requireRole("support", "billing_admin"), async (req, res) => {
    const payment = await payments.findByIdForAccount(req.params.paymentId, req.auth!.accountId);
    if (!payment) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json(payment);
  });

  router.post(
    "/payments/:paymentId/refunds",
    requireRole("billing_admin"),
    requireScope("refunds:write"),
    async (req, res) => {
      const amountCents = Number(req.body?.amountCents);
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return res.status(400).json({ error: "invalid_amount" });
      }

      const payment = await payments.findById(req.params.paymentId);
      if (!payment) {
        return res.status(404).json({ error: "not_found" });
      }
      if (payment.refundedCents + amountCents > payment.amountCents) {
        return res.status(409).json({ error: "refund_exceeds_payment" });
      }

      const updated = await payments.recordRefund(payment.id, amountCents);
      return res.status(201).json(updated);
    },
  );

  return router;
}
