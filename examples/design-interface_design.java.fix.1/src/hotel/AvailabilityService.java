package hotel;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

public final class AvailabilityService {
    private final RoomInventory inventory;
    private final Map<LocalDate, Set<String>> bookedByNight = new HashMap<>();

    public AvailabilityService(RoomInventory inventory) {
        this.inventory = inventory;
    }

    public List<Room> search(String type, int maxRate, LocalDate night) {
        Set<String> booked = bookedByNight.getOrDefault(night, Set.of());
        List<Room> candidates = inventory.rooms();
        candidates.removeIf(r -> booked.contains(r.number()));
        candidates.removeIf(r -> !r.type().equals(type) || r.nightlyRate() > maxRate);
        candidates.sort(Comparator.comparingInt(Room::nightlyRate).thenComparing(Room::number));
        return candidates;
    }

    public Optional<Room> bookCheapest(String type, int maxRate, LocalDate night) {
        List<Room> options = search(type, maxRate, night);
        if (options.isEmpty()) {
            return Optional.empty();
        }
        Room chosen = options.get(0);
        bookedByNight.computeIfAbsent(night, d -> new HashSet<>()).add(chosen.number());
        return Optional.of(chosen);
    }

    public double occupancy(LocalDate night) {
        int total = inventory.size();
        if (total == 0) {
            return 0.0;
        }
        return (double) bookedByNight.getOrDefault(night, Set.of()).size() / total;
    }
}
