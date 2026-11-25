package notify.service;

import notify.config.AppConfig;
import notify.mail.Mailer;

public final class ShipmentNotifier {

    private final AppConfig config;
    private final Mailer mailer;

    public ShipmentNotifier(AppConfig config, Mailer mailer) {
        this.config = config;
        this.mailer = mailer;
    }

    public void shipped(String customerEmail, String orderId, String carrier) {
        String subject = subjectFor("Your order " + orderId + " has shipped");
        String body = "Order " + orderId + " left our warehouse with " + carrier + ".\n"
                + "Original recipient: " + customerEmail;
        mailer.send(new Mailer.Message(config.fromAddress(), recipientFor(customerEmail), subject, body));
    }

    public void shippedAll(java.util.Map<String, String> emailByOrderId, String carrier) {
        for (java.util.Map.Entry<String, String> entry : emailByOrderId.entrySet()) {
            shipped(entry.getValue(), entry.getKey(), carrier);
        }
    }

    public void delayed(String customerEmail, String orderId, int days) {
        String subject = subjectFor("Order " + orderId + " is delayed");
        String body = "We expect a delay of " + days + " day(s) on order " + orderId + ".";
        mailer.send(new Mailer.Message(config.fromAddress(), recipientFor(customerEmail), subject, body));
    }

    public void refunded(String customerEmail, String orderId, long amountCents) {
        String subject = subjectFor("Refund issued for order " + orderId);
        String amount = String.format("%d.%02d", amountCents / 100, amountCents % 100);
        String body = "We refunded " + amount + " to your original payment method.\n"
                + "Original recipient: " + customerEmail;
        mailer.send(new Mailer.Message(config.fromAddress(), recipientFor(customerEmail), subject, body));
    }

    private String recipientFor(String customerEmail) {
        if (config.environment() == "production") {
            return customerEmail;
        }
        return config.sandboxRecipient();
    }

    private String subjectFor(String subject) {
        if (config.environment().equals("production")) {
            return subject;
        }
        return "[" + config.environment() + "] " + subject;
    }
}
