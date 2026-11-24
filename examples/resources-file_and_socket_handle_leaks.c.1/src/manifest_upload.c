#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <netdb.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>

#include "manifest_upload.h"

#define CHUNK_SIZE 4096
#define SEND_TIMEOUT_SEC 10

static int dial(const char *host, const char *port)
{
    struct addrinfo hints, *res = NULL, *ai;
    int fd = -1;
    int connected = 0;

    memset(&hints, 0, sizeof hints);
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    if (getaddrinfo(host, port, &hints, &res) != 0) {
        return -1;
    }

    for (ai = res; ai != NULL; ai = ai->ai_next) {
        fd = socket(ai->ai_family, ai->ai_socktype, ai->ai_protocol);
        if (fd < 0) {
            continue;
        }
        if (connect(fd, ai->ai_addr, ai->ai_addrlen) != 0) {
            continue;
        }
        connected = 1;
        break;
    }
    freeaddrinfo(res);
    if (!connected) {
        return -1;
    }

    struct timeval tv = { .tv_sec = SEND_TIMEOUT_SEC, .tv_usec = 0 };
    if (setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof tv) != 0) {
        close(fd);
        return -1;
    }
    return fd;
}

static int send_all(int fd, const char *buf, size_t len)
{
    size_t sent = 0;
    while (sent < len) {
        ssize_t n = send(fd, buf + sent, len - sent, MSG_NOSIGNAL);
        if (n < 0) {
            if (errno == EINTR) {
                continue;
            }
            return -1;
        }
        sent += (size_t)n;
    }
    return 0;
}

int upload_manifest(const char *path, const char *host, const char *port,
                    struct upload_stats *stats)
{
    char buf[CHUNK_SIZE];
    size_t n;
    int fd = -1;
    int rc = UPLOAD_ERR_IO;

    stats->bytes_sent = 0;
    stats->chunks = 0;

    FILE *fp = fopen(path, "rb");
    if (fp == NULL) {
        return UPLOAD_ERR_OPEN;
    }

    fd = dial(host, port);
    if (fd < 0) {
        rc = UPLOAD_ERR_CONNECT;
        goto done;
    }

    while ((n = fread(buf, 1, sizeof buf, fp)) > 0) {
        if (send_all(fd, buf, n) != 0) {
            rc = UPLOAD_ERR_SEND;
            goto done;
        }
        stats->bytes_sent += n;
        stats->chunks++;
    }
    if (ferror(fp)) {
        rc = UPLOAD_ERR_IO;
        goto done;
    }
    if (shutdown(fd, SHUT_WR) != 0) {
        rc = UPLOAD_ERR_SEND;
        goto done;
    }
    rc = UPLOAD_OK;

done:
    if (fd >= 0) {
        close(fd);
    }
    fclose(fp);
    return rc;
}

const char *upload_status_name(int status)
{
    switch (status) {
    case UPLOAD_OK:          return "ok";
    case UPLOAD_ERR_OPEN:    return "cannot open manifest";
    case UPLOAD_ERR_CONNECT: return "cannot connect";
    case UPLOAD_ERR_SEND:    return "send failed";
    case UPLOAD_ERR_IO:      return "read failed";
    default:                 return "unknown";
    }
}
