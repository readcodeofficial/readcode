import type { Database } from "../orm/db.ts";
import { Session } from "../orm/session.ts";
import { drop, enroll, type Course, type EnrollResult } from "./courses.ts";

// Each request gets its own session and commits once at the end.
export function register(db: Database, studentId: string, courseIds: string[]): Record<string, EnrollResult> {
    const session = new Session(db);
    const results: Record<string, EnrollResult> = {};
    for (const courseId of courseIds) results[courseId] = enroll(session, courseId, studentId);
    session.flush();
    return results;
}

export function withdraw(db: Database, studentId: string, courseId: string): void {
    const session = new Session(db);
    drop(session, courseId, studentId);
    session.flush();
}

export function rosterReport(db: Database, courseId: string) {
    const course = new Session(db).get<Course>("courses", courseId);
    if (!course) throw new Error(`Unknown course ${courseId}`);
    return { seatsTaken: course.seatsTaken, roster: course.roster, waitlist: course.waitlist };
}
