#ifndef INVENTORY_H
#define INVENTORY_H

#include <pthread.h>
#include <stdatomic.h>
#include <stddef.h>

#define MAX_HOLDS 64

typedef enum {
    RESERVE_OK = 0,
    RESERVE_SOLD_OUT = -1,
    RESERVE_HOLD_TABLE_FULL = -2,
    RESERVE_BAD_ARG = -3
} reserve_result_t;

typedef struct {
    unsigned long hold_id;
    int seats;
    int active;
} hold_t;

typedef struct {
    char flight_no[8];
    int capacity;
    int available;
    hold_t holds[MAX_HOLDS];
    pthread_mutex_t lock;
    atomic_ulong next_hold_id;
} flight_inventory_t;

void inventory_init(flight_inventory_t *inv, const char *flight_no, int capacity);
reserve_result_t inventory_reserve(flight_inventory_t *inv, int seats, unsigned long *hold_id_out);
int inventory_release(flight_inventory_t *inv, unsigned long hold_id);
int inventory_available(flight_inventory_t *inv);

#endif
