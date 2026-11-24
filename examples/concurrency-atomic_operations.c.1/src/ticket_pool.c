#include "ticket_pool.h"

#include <stdlib.h>
#include <string.h>

void pool_init(ticket_pool_t *pool, int max_queued)
{
    atomic_init(&pool->next_id, 1);
    atomic_init(&pool->queued, 0);
    atomic_init(&pool->closing, false);
    pool->max_queued = max_queued;
}

void pool_close(ticket_pool_t *pool)
{
    atomic_store_explicit(&pool->closing, true, memory_order_release);
}

static char *dup_string(const char *s)
{
    size_t n = strlen(s) + 1;
    char *copy = malloc(n);
    if (copy != NULL) {
        memcpy(copy, s, n);
    }
    return copy;
}

ticket_t *ticket_create(ticket_pool_t *pool, const char *subject, const char *body)
{
    if (atomic_load_explicit(&pool->closing, memory_order_acquire)) {
        return NULL;
    }

    ticket_t *t = calloc(1, sizeof(*t));
    if (t == NULL) {
        return NULL;
    }
    t->subject = dup_string(subject);
    t->body = dup_string(body);
    if (t->subject == NULL || t->body == NULL) {
        free(t->subject);
        free(t->body);
        free(t);
        return NULL;
    }

    t->id = atomic_fetch_add_explicit(&pool->next_id, 1, memory_order_relaxed);
    atomic_init(&t->refs, 1);
    return t;
}

ticket_t *ticket_retain(ticket_t *t)
{
    atomic_fetch_add_explicit(&t->refs, 1, memory_order_relaxed);
    return t;
}

void ticket_release(ticket_t *t)
{
    if (atomic_fetch_sub_explicit(&t->refs, 1, memory_order_relaxed) == 1) {
        free(t->subject);
        free(t->body);
        free(t);
    }
}

bool pool_try_reserve_slot(ticket_pool_t *pool)
{
    int current = atomic_load_explicit(&pool->queued, memory_order_relaxed);
    do {
        if (current >= pool->max_queued) {
            return false;
        }
    } while (!atomic_compare_exchange_weak_explicit(
        &pool->queued, &current, current + 1,
        memory_order_acq_rel, memory_order_relaxed));
    return true;
}

void pool_release_slot(ticket_pool_t *pool)
{
    atomic_fetch_sub_explicit(&pool->queued, 1, memory_order_acq_rel);
}
