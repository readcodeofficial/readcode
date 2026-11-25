package pay;

public final class PaymentService {
    public enum Status { APPROVED, GATEWAY_ERROR, REJECTED_CIRCUIT_OPEN }

    public record Result(Status status, String chargeId) {}

    private final Gateway gateway;
    private final CircuitBreaker breaker;

    public PaymentService(Gateway gateway, CircuitBreaker breaker) {
        this.gateway = gateway;
        this.breaker = breaker;
    }

    public Result charge(String cardToken, long amountCents) {
        if (!breaker.tryAcquire()) {
            return new Result(Status.REJECTED_CIRCUIT_OPEN, null);
        }
        try {
            String chargeId = gateway.charge(cardToken, amountCents);
            breaker.recordSuccess();
            return new Result(Status.APPROVED, chargeId);
        } catch (GatewayException e) {
            breaker.recordFailure();
            return new Result(Status.GATEWAY_ERROR, null);
        }
    }
}
