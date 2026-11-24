#ifndef AUTHZ_H
#define AUTHZ_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct authz_handle authz_handle;

enum authz_result {
    AUTHZ_ALLOW = 0,
    AUTHZ_DENY = 1,
    AUTHZ_ERROR = -1
};

/* Loads the policy file. Returns NULL on failure; see authz_last_error(). */
authz_handle* authz_open(const char* policy_path);

/* Evaluates a request for a role. Never throws; returns AUTHZ_ERROR on internal failure. */
int authz_check(authz_handle* h, const char* role, const char* action, const char* resource);

/* Re-reads the policy file on a background thread, then invokes cb(ctx, result). */
typedef void (*authz_reload_cb)(void* ctx, int result);
int authz_reload_async(authz_handle* h, authz_reload_cb cb, void* ctx);

/* Message for the most recent failure on the calling thread. */
const char* authz_last_error(void);

void authz_close(authz_handle* h);

#ifdef __cplusplus
}
#endif

#endif
