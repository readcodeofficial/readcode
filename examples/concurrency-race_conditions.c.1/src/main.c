#include <stdio.h>

#include "inventory.h"

#define WORKERS 8
#define ATTEMPTS_PER_WORKER 40

static flight_inventory_t inventory;

static void *booking_worker(void *arg)
{
    long *granted = arg;
    for (int i = 0; i < ATTEMPTS_PER_WORKER; i++) {
        unsigned long hold;
        if (inventory_reserve(&inventory, 2, &hold) == RESERVE_OK) {
            *granted += 2;
        }
    }
    return NULL;
}

int main(void)
{
    pthread_t threads[WORKERS];
    long granted[WORKERS] = {0};
    long total = 0;

    inventory_init(&inventory, "TK1984", 150);

    for (int i = 0; i < WORKERS; i++) {
        pthread_create(&threads[i], NULL, booking_worker, &granted[i]);
    }
    for (int i = 0; i < WORKERS; i++) {
        pthread_join(threads[i], NULL);
        total += granted[i];
    }

    printf("flight %s: sold %ld of %d seats, %d left\n", inventory.flight_no, total,
           inventory.capacity, inventory_available(&inventory));
    return 0;
}
