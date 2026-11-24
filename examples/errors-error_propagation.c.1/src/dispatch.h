#ifndef DISPATCH_H
#define DISPATCH_H

#include <stddef.h>

struct courier {
    int id;
    int capacity;
    int load;
    double lat;
    double lon;
};

struct order {
    int id;
    double lat;
    double lon;
};

struct assignment {
    int order_id;
    int courier_id;
};

/* Assigns each order to the nearest courier that still has capacity.
 * Returns the number of orders assigned (0 or more) or a negative errno value.
 * On success *out is a heap array of that many assignments owned by the caller;
 * on failure *out is NULL. */
int dispatch_batch(struct courier *couriers, size_t ncouriers,
                   const struct order *orders, size_t norders,
                   struct assignment **out);

#endif
