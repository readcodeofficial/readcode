package hotel;

import java.util.ArrayList;
import java.util.List;

public final class InMemoryRoomInventory implements RoomInventory {
    private final List<Room> rooms = new ArrayList<>();

    @Override
    public List<Room> rooms() {
        return rooms;
    }

    @Override
    public void add(Room room) {
        for (Room existing : rooms) {
            if (existing.number().equals(room.number())) {
                throw new IllegalStateException("duplicate room " + room.number());
            }
        }
        rooms.add(room);
    }

    @Override
    public boolean remove(String number) {
        return rooms.removeIf(r -> r.number().equals(number));
    }

    @Override
    public int size() {
        return rooms.size();
    }
}
