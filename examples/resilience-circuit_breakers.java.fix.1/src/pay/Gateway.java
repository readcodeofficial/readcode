package pay;

public interface Gateway {
    /** Returns the gateway's charge id, or throws when the gateway is unreachable or errors. */
    String charge(String cardToken, long amountCents) throws GatewayException;
}
