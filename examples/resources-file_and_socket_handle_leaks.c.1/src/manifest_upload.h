#ifndef MANIFEST_UPLOAD_H
#define MANIFEST_UPLOAD_H

#include <stddef.h>

enum upload_status {
    UPLOAD_OK = 0,
    UPLOAD_ERR_OPEN = 1,
    UPLOAD_ERR_CONNECT = 2,
    UPLOAD_ERR_SEND = 3,
    UPLOAD_ERR_IO = 4
};

struct upload_stats {
    size_t bytes_sent;
    unsigned chunks;
};

/* Streams the file at path to host:port over TCP and half-closes the socket when done. */
int upload_manifest(const char *path, const char *host, const char *port,
                    struct upload_stats *stats);

const char *upload_status_name(int status);

#endif
