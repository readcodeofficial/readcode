#include "inventory.h"

#include <string.h>

void inventory_init(flight_inventory_t *inv, const char *flight_no, int capacity)
{
    memset(inv, 0, sizeof(*inv));
    strncpy(inv->flight_no, flight_no, sizeof(inv->flight_no) - 1);
    inv->capacity = capacity;
    inv->available = capacity;
    pthread_mutex_init(&inv->lock, NULL);
    atomic_init(&inv->next_hold_id, 1);
}

int inventory_available(flight_inventory_t *inv)
{
    int n;
    pthread_mutex_lock(&inv->lock);
    n = inv->available;
    pthread_mutex_unlock(&inv->lock);
    return n;
}

reserve_result_t inventory_reserve(flight_inventory_t *inv, int seats, unsigned long *hold_id_out)
{
    if (seats <= 0 || hold_id_out == NULL) {
        return RESERVE_BAD_ARG;
    }

    if (inv->available < seats) {
        return RESERVE_SOLD_OUT;
    }

    pthread_mutex_lock(&inv->lock);

    int slot = -1;
    for (int i = 0; i < MAX_HOLDS; i++) {
        if (!inv->holds[i].active) {
            slot = i;
            break;
        }
    }
    if (slot < 0) {
        pthread_mutex_unlock(&inv->lock);
        return RESERVE_HOLD_TABLE_FULL;
    }

    unsigned long id = atomic_fetch_add(&inv->next_hold_id, 1);
    inv->holds[slot].hold_id = id;
    inv->holds[slot].seats = seats;
    inv->holds[slot].active = 1;
    inv->available -= seats;

    pthread_mutex_unlock(&inv->lock);
    *hold_id_out = id;
    return RESERVE_OK;
}

int inventory_release(flight_inventory_t *inv, unsigned long hold_id)
{
    int released = 0;

    pthread_mutex_lock(&inv->lock);
    for (int i = 0; i < MAX_HOLDS; i++) {
        hold_t *h = &inv->holds[i];
        if (h->active && h->hold_id == hold_id) {
            inv->available += h->seats;
            h->active = 0;
            released = h->seats;
            break;
        }
    }
    pthread_mutex_unlock(&inv->lock);

    return released;
}
