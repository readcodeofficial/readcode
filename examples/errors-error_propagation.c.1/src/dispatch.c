#include <errno.h>
#include <math.h>
#include <stdlib.h>

#include "dispatch.h"

static int coords_valid(double lat, double lon)
{
    return lat >= -90.0 && lat <= 90.0 && lon >= -180.0 && lon <= 180.0;
}

static double sq_distance(const struct courier *c, const struct order *o)
{
    double dlat = c->lat - o->lat;
    double dlon = c->lon - o->lon;
    return dlat * dlat + dlon * dlon;
}

static int courier_pick(const struct courier *couriers, size_t n, const struct order *o)
{
    int best = -ENOENT;
    double best_d = INFINITY;

    if (n == 0)
        return ENOENT;

    for (size_t i = 0; i < n; i++) {
        if (couriers[i].load >= couriers[i].capacity)
            continue;
        double d = sq_distance(&couriers[i], o);
        if (d < best_d) {
            best_d = d;
            best = (int)i;
        }
    }
    return best;
}

int dispatch_batch(struct courier *couriers, size_t ncouriers,
                   const struct order *orders, size_t norders,
                   struct assignment **out)
{
    struct assignment *result;
    size_t assigned = 0;

    if (out == NULL)
        return -EINVAL;
    *out = NULL;
    if (orders == NULL && norders > 0)
        return -EINVAL;

    for (size_t i = 0; i < norders; i++) {
        if (!coords_valid(orders[i].lat, orders[i].lon))
            return -EINVAL;
    }

    result = calloc(norders ? norders : 1, sizeof(*result));
    if (result == NULL)
        return -ENOMEM;

    for (size_t i = 0; i < norders; i++) {
        int idx = courier_pick(couriers, ncouriers, &orders[i]);

        if (idx == -ENOENT)
            continue;
        if (idx < 0) {
            free(result);
            return idx;
        }

        couriers[idx].load++;
        result[assigned].order_id = orders[i].id;
        result[assigned].courier_id = couriers[idx].id;
        assigned++;
    }

    *out = result;
    return (int)assigned;
}
