import type { Session } from "../orm/session.ts";

export interface Course {
    id: string;
    title: string;
    credits: number;
    capacity: number;
    seatsTaken: number;
    roster: string[]; // student ids, in enrollment order
    waitlist: string[];
    [column: string]: unknown;
}

export interface Student {
    id: string;
    name: string;
    credits: number; // credits currently registered for
    maxCredits: number;
    [column: string]: unknown;
}

export type EnrollResult = "enrolled" | "waitlisted" | "already_registered" | "credit_limit";

function load<T>(session: Session, table: string, id: string): T {
    const row = session.get(table, id);
    if (!row) throw new Error(`Unknown ${table} ${id}`);
    return row as unknown as T;
}

export function enroll(session: Session, courseId: string, studentId: string): EnrollResult {
    const course = load<Course>(session, "courses", courseId);
    const student = load<Student>(session, "students", studentId);
    if (course.roster.includes(studentId) || course.waitlist.includes(studentId)) return "already_registered";

    if (course.seatsTaken >= course.capacity) {
        course.waitlist.push(studentId);
        return "waitlisted";
    }
    if (student.credits + course.credits > student.maxCredits) return "credit_limit";
    course.roster.push(studentId);
    course.seatsTaken += 1;
    student.credits += course.credits;
    return "enrolled";
}

// Drop a course; the seat goes to the first waitlisted student who still has room for it.
export function drop(session: Session, courseId: string, studentId: string): void {
    const course = load<Course>(session, "courses", courseId);
    const waiting = course.waitlist.indexOf(studentId);
    if (waiting !== -1) {
        course.waitlist.splice(waiting, 1);
        return;
    }
    const seat = course.roster.indexOf(studentId);
    if (seat === -1) return;

    course.roster.splice(seat, 1);
    course.seatsTaken -= 1;
    load<Student>(session, "students", studentId).credits -= course.credits;

    for (let i = 0; i < course.waitlist.length; i++) {
        const next = load<Student>(session, "students", course.waitlist[i]);
        if (next.credits + course.credits > next.maxCredits) continue;
        course.waitlist.splice(i, 1);
        course.roster.push(next.id);
        course.seatsTaken += 1;
        next.credits += course.credits;
        return;
    }
}
