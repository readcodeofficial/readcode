#include <stdio.h>
#include <string.h>
#include "appointments.h"

static int rollback_quietly(sqlite3 *db)
{
    char *msg = NULL;
    int rc = sqlite3_exec(db, "ROLLBACK", NULL, NULL, &msg);
    if (rc != SQLITE_OK) {
        fprintf(stderr, "rollback failed: %s\n", msg ? msg : sqlite3_errmsg(db));
        sqlite3_free(msg);
    }
    return rc;
}

static int count_overlaps(sqlite3 *db, const struct appt_request *req, int *count)
{
    static const char *sql =
        "SELECT COUNT(*) FROM appointments "
        "WHERE clinician_id = ?1 AND status = 'booked' AND starts_at < ?3 AND ends_at > ?2";
    sqlite3_stmt *stmt = NULL;
    int rc = sqlite3_prepare_v2(db, sql, -1, &stmt, NULL);
    if (rc != SQLITE_OK)
        return rc;

    sqlite3_bind_int64(stmt, 1, req->clinician_id);
    sqlite3_bind_int64(stmt, 2, (sqlite3_int64)req->starts_at);
    sqlite3_bind_int64(stmt, 3, (sqlite3_int64)req->ends_at);

    rc = sqlite3_step(stmt);
    if (rc == SQLITE_ROW) {
        *count = sqlite3_column_int(stmt, 0);
        rc = SQLITE_OK;
    }
    sqlite3_finalize(stmt);
    return rc;
}

int appt_book(sqlite3 *db, const struct appt_request *req, long long *out_id)
{
    sqlite3_stmt *ins = NULL;
    int overlaps = 0;
    int rc;

    if (db == NULL || req == NULL || req->ends_at <= req->starts_at)
        return APPT_ERR_ARGS;

    if (sqlite3_exec(db, "BEGIN IMMEDIATE", NULL, NULL, NULL) != SQLITE_OK)
        return APPT_ERR_DB;

    rc = count_overlaps(db, req, &overlaps);
    if (rc != SQLITE_OK) {
        rollback_quietly(db);
        return APPT_ERR_DB;
    }
    if (overlaps > 0) {
        rollback_quietly(db);
        return APPT_ERR_CONFLICT;
    }

    rc = sqlite3_prepare_v2(db,
        "INSERT INTO appointments (clinician_id, patient_id, starts_at, ends_at, status) "
        "VALUES (?1, ?2, ?3, ?4, 'booked')", -1, &ins, NULL);
    if (rc != SQLITE_OK) {
        rollback_quietly(db);
        return APPT_ERR_DB;
    }
    sqlite3_bind_int64(ins, 1, req->clinician_id);
    sqlite3_bind_int64(ins, 2, req->patient_id);
    sqlite3_bind_int64(ins, 3, (sqlite3_int64)req->starts_at);
    sqlite3_bind_int64(ins, 4, (sqlite3_int64)req->ends_at);

    rc = sqlite3_step(ins);
    sqlite3_finalize(ins);
    if (rc != SQLITE_DONE) {
        rollback_quietly(db);
        return APPT_ERR_DB;
    }

    if (out_id != NULL)
        *out_id = sqlite3_last_insert_rowid(db);

    if (sqlite3_exec(db, "COMMIT", NULL, NULL, NULL) != SQLITE_OK) {
        rollback_quietly(db);
        return APPT_ERR_DB;
    }
    return APPT_OK;
}
