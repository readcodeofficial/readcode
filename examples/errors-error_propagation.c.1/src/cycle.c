#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "dispatch.h"

extern int publish_assignments(const struct assignment *a, size_t n);

int run_dispatch_cycle(struct courier *couriers, size_t ncouriers,
                       const struct order *orders, size_t norders)
{
    struct assignment *assignments = NULL;
    int rc = dispatch_batch(couriers, ncouriers, orders, norders, &assignments);

    if (rc < 0) {
        fprintf(stderr, "dispatch: batch of %zu orders failed: %s\n",
                norders, strerror(-rc));
        return rc;
    }

    if ((size_t)rc < norders)
        fprintf(stderr, "dispatch: %zu of %zu orders left unassigned\n",
                norders - (size_t)rc, norders);

    if (rc > 0) {
        int prc = publish_assignments(assignments, (size_t)rc);
        if (prc < 0) {
            fprintf(stderr, "dispatch: publish failed: %s\n", strerror(-prc));
            free(assignments);
            return prc;
        }
    }

    free(assignments);
    return rc;
}
