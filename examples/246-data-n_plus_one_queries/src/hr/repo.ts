import { BatchLoader } from "./batchLoader.ts";

export interface Db {
    query<T>(sql: string, params: unknown[]): Promise<T[]>;
}

export interface Employee {
    id: string;
    name: string;
    title: string;
    departmentId: string;
    managerId: string | null;
    officeId: string;
}

export interface Office {
    id: string;
    city: string;
}

export interface Review {
    employeeId: string;
    cycle: string;
    rating: 1 | 2 | 3 | 4 | 5;
}

const byKey = <K, V>(rows: V[], key: (v: V) => K) => new Map(rows.map((r) => [key(r), r]));

export function employeesInDepartment(db: Db, departmentId: string): Promise<Employee[]> {
    return db.query<Employee>("SELECT * FROM employees WHERE department_id = $1 ORDER BY name", [departmentId]);
}

export function makeLoaders(db: Db) {
    return {
        employees: new BatchLoader<string, Employee>(async (ids) =>
            byKey(await db.query<Employee>("SELECT * FROM employees WHERE id = ANY($1)", [ids]), (e) => e.id),
        ),
        offices: new BatchLoader<string, Office>(async (ids) =>
            byKey(await db.query<Office>("SELECT * FROM offices WHERE id = ANY($1)", [ids]), (o) => o.id),
        ),
        // Latest completed review per employee.
        latestReviews: new BatchLoader<string, Review>(async (ids) =>
            byKey(
                await db.query<Review>(
                    "SELECT DISTINCT ON (employee_id) * FROM reviews WHERE employee_id = ANY($1) ORDER BY employee_id, cycle DESC",
                    [ids],
                ),
                (r) => r.employeeId,
            ),
        ),
    };
}

export type Loaders = ReturnType<typeof makeLoaders>;
