import { employeesInDepartment, makeLoaders, type Db } from "./repo.ts";

export interface DirectoryRow {
    id: string;
    name: string;
    title: string;
    manager: string | null;
    city: string | null;
    lastRating: number | null;
}

// GET /departments/:id/directory — the team page managers open before calibration meetings.
export async function teamDirectory(db: Db, departmentId: string): Promise<DirectoryRow[]> {
    const loaders = makeLoaders(db);
    const employees = await employeesInDepartment(db, departmentId);

    const rows: DirectoryRow[] = [];
    for (const e of employees) {
        const [manager, office, review] = await Promise.all([
            e.managerId ? loaders.employees.load(e.managerId) : Promise.resolve(null),
            loaders.offices.load(e.officeId),
            loaders.latestReviews.load(e.id),
        ]);
        rows.push({
            id: e.id,
            name: e.name,
            title: e.title,
            manager: manager?.name ?? null,
            city: office?.city ?? null,
            lastRating: review?.rating ?? null,
        });
    }
    return rows;
}

// Average of the latest ratings, ignoring people who haven't had a review yet.
export function averageRating(rows: DirectoryRow[]): number | null {
    const rated = rows.filter((r) => r.lastRating !== null);
    if (rated.length === 0) return null;
    return Math.round((rated.reduce((s, r) => s + r.lastRating!, 0) / rated.length) * 100) / 100;
}
