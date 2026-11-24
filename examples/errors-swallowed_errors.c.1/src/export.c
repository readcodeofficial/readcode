#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include "appointments.h"

#define PATH_MAX_LEN 512

int appt_export_day(sqlite3 *db, long long clinician_id, time_t day_start, const char *path)
{
    char tmp_path[PATH_MAX_LEN];
    sqlite3_stmt *stmt = NULL;
    FILE *fp = NULL;
    int rc;

    if (snprintf(tmp_path, sizeof tmp_path, "%s.tmp", path) >= (int)sizeof tmp_path)
        return APPT_ERR_ARGS;

    rc = sqlite3_prepare_v2(db,
        "SELECT id, patient_id, starts_at, ends_at FROM appointments "
        "WHERE clinician_id = ?1 AND status = 'booked' AND starts_at >= ?2 AND starts_at < ?3 "
        "ORDER BY starts_at", -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return APPT_ERR_DB;
    sqlite3_bind_int64(stmt, 1, clinician_id);
    sqlite3_bind_int64(stmt, 2, (sqlite3_int64)day_start);
    sqlite3_bind_int64(stmt, 3, (sqlite3_int64)day_start + 24 * 3600);

    fp = fopen(tmp_path, "w");
    if (fp == NULL) {
        fprintf(stderr, "open %s: %s\n", tmp_path, strerror(errno));
        sqlite3_finalize(stmt);
        return APPT_ERR_IO;
    }

    if (fprintf(fp, "id,patient_id,starts_at,ends_at\n") < 0)
        goto io_fail;

    while ((rc = sqlite3_step(stmt)) == SQLITE_ROW) {
        if (fprintf(fp, "%lld,%lld,%lld,%lld\n",
                    sqlite3_column_int64(stmt, 0), sqlite3_column_int64(stmt, 1),
                    sqlite3_column_int64(stmt, 2), sqlite3_column_int64(stmt, 3)) < 0)
            goto io_fail;
    }
    if (rc != SQLITE_DONE) {
        fprintf(stderr, "export query failed: %s\n", sqlite3_errmsg(db));
        sqlite3_finalize(stmt);
        fclose(fp);
        unlink(tmp_path);
        return APPT_ERR_DB;
    }
    sqlite3_finalize(stmt);

    fclose(fp);

    if (rename(tmp_path, path) != 0) {
        fprintf(stderr, "rename %s: %s\n", tmp_path, strerror(errno));
        unlink(tmp_path);
        return APPT_ERR_IO;
    }
    return APPT_OK;

io_fail:
    fprintf(stderr, "write %s: %s\n", tmp_path, strerror(errno));
    sqlite3_finalize(stmt);
    fclose(fp);
    unlink(tmp_path);
    return APPT_ERR_IO;
}
