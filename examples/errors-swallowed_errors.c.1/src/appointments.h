#ifndef APPOINTMENTS_H
#define APPOINTMENTS_H

#include <sqlite3.h>
#include <time.h>

enum appt_status {
    APPT_OK = 0,
    APPT_ERR_DB = -1,
    APPT_ERR_CONFLICT = -2,
    APPT_ERR_IO = -3,
    APPT_ERR_ARGS = -4
};

struct appt_request {
    long long clinician_id;
    long long patient_id;
    time_t starts_at;
    time_t ends_at;
};

int appt_book(sqlite3 *db, const struct appt_request *req, long long *out_id);
int appt_export_day(sqlite3 *db, long long clinician_id, time_t day_start, const char *path);

#endif
