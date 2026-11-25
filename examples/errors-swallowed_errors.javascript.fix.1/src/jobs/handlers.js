export function createHandlers({ renderer, mailer }) {
  return {
    async "invoice.send"({ invoiceId, email }) {
      const pdf = await renderer.render(invoiceId);
      if (!pdf || pdf.length === 0) throw new Error(`renderer returned an empty PDF for ${invoiceId}`);
      await mailer.send(email, `Invoice ${invoiceId}`, pdf);
    },
    async "invoice.void"({ invoiceId }) {
      await renderer.discard(invoiceId);
    },
  };
}
