#define _POSIX_C_SOURCE 200809L
#include <stdio.h>
#include <unistd.h>

#include "manifest_upload.h"

#define MAX_ATTEMPTS 4

int main(int argc, char **argv)
{
    if (argc < 4) {
        fprintf(stderr, "usage: %s host port manifest...\n", argv[0]);
        return 2;
    }

    int failures = 0;
    for (int i = 3; i < argc; i++) {
        struct upload_stats stats;
        int rc = UPLOAD_ERR_CONNECT;

        for (int attempt = 0; attempt < MAX_ATTEMPTS && rc == UPLOAD_ERR_CONNECT; attempt++) {
            if (attempt > 0) {
                sleep(1u << attempt);
            }
            rc = upload_manifest(argv[i], argv[1], argv[2], &stats);
        }

        if (rc == UPLOAD_OK) {
            printf("%s: %zu bytes in %u chunks\n", argv[i], stats.bytes_sent, stats.chunks);
        } else {
            fprintf(stderr, "%s: %s\n", argv[i], upload_status_name(rc));
            failures++;
        }
    }
    return failures == 0 ? 0 : 1;
}
