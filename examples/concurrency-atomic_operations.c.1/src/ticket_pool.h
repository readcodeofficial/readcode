#ifndef TICKET_POOL_H
#define TICKET_POOL_H

#include <stdatomic.h>
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

typedef struct ticket {
    uint64_t id;
    char *subject;
    char *body;
    atomic_int refs;
} ticket_t;

typedef struct ticket_pool {
    atomic_uint_fast64_t next_id;
    atomic_int queued;
    int max_queued;
    atomic_bool closing;
} ticket_pool_t;

void pool_init(ticket_pool_t *pool, int max_queued);
void pool_close(ticket_pool_t *pool);

ticket_t *ticket_create(ticket_pool_t *pool, const char *subject, const char *body);
ticket_t *ticket_retain(ticket_t *t);
void ticket_release(ticket_t *t);

bool pool_try_reserve_slot(ticket_pool_t *pool);
void pool_release_slot(ticket_pool_t *pool);

#endif
