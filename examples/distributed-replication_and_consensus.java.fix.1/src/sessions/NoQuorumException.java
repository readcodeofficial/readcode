package sessions;

public class NoQuorumException extends RuntimeException {
    public NoQuorumException(String message) {
        super(message);
    }
}
