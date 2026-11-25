package shipping;

/** One delivery attempt of a message: the broker redelivers the same id with a higher attempt number. */
public record Delivery(long id, String body, int attempt) {
}
