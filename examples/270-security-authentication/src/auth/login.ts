import { hashPassword, verifyPassword } from "./passwords.ts";
import type { LoginThrottle } from "./throttle.ts";

export interface Employee {
    id: string;
    username: string; // stored normalized
    passwordHash: string;
    disabled: boolean;
}

export interface EmployeeDirectory {
    findByUsername(username: string): Promise<Employee | null>;
}

export interface SessionIssuer {
    issue(employeeId: string): Promise<string>;
}

export type LoginResult =
    | { ok: true; employeeId: string; sessionId: string }
    | { ok: false; reason: "invalid_credentials" }
    | { ok: false; reason: "locked"; retryAfterMs: number };

// Usernames are case-insensitive, and people paste them with stray spaces.
export const normalizeUsername = (username: string) => username.trim().toLowerCase();

// Checked when the username doesn't exist, so unknown and known usernames take the same time.
const DUMMY_HASH = hashPassword("placeholder-password-never-matches");

// Payroll portal sign-in.
export function loginService(directory: EmployeeDirectory, throttle: LoginThrottle, sessions: SessionIssuer, now: () => number) {
    return {
        async login(username: string, password: string): Promise<LoginResult> {
            const t = now();
            if (throttle.isLocked(username, t)) {
                return { ok: false, reason: "locked", retryAfterMs: throttle.lockedUntil(username) - t };
            }

            const employee = await directory.findByUsername(normalizeUsername(username));
            const passwordOk = verifyPassword(password, employee?.passwordHash ?? DUMMY_HASH);
            if (!employee || !passwordOk || employee.disabled) {
                throttle.recordFailure(username, t);
                return { ok: false, reason: "invalid_credentials" };
            }

            throttle.reset(username);
            return { ok: true, employeeId: employee.id, sessionId: await sessions.issue(employee.id) };
        },
    };
}
