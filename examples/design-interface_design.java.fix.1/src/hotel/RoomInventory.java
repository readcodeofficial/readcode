package hotel;

import java.util.List;

public interface RoomInventory {
    List<Room> rooms();

    void add(Room room);

    boolean remove(String number);

    int size();
}
