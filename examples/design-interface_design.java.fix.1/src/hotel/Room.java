package hotel;

public record Room(String number, String type, int nightlyRate) {
    public Room {
        if (number == null || number.isBlank()) {
            throw new IllegalArgumentException("room number required");
        }
        if (nightlyRate <= 0) {
            throw new IllegalArgumentException("nightly rate must be positive");
        }
    }
}
