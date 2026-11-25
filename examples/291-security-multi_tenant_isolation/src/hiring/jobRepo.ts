export interface Job {
    tenantId: string;
    id: string;
    slug: string; // unique within a tenant, used in careers-page URLs
    title: string;
    location: string;
    status: "draft" | "open" | "closed";
}

// In-memory stand-in for the jobs table. Every query takes the tenant explicitly.
export class JobRepo {
    private readonly rows = new Map<string, Job>();

    async save(job: Job): Promise<void> {
        const clash = [...this.rows.values()].find((j) => j.tenantId === job.tenantId && j.slug === job.slug && j.id !== job.id);
        if (clash) throw new Error(`slug ${job.slug} already used by job ${clash.id}`);
        this.rows.set(`${job.tenantId}/${job.id}`, { ...job });
    }

    async byId(tenantId: string, id: string): Promise<Job | null> {
        const job = this.rows.get(`${tenantId}/${id}`);
        return job ? { ...job } : null;
    }

    async bySlug(tenantId: string, slug: string): Promise<Job | null> {
        const job = [...this.rows.values()].find((j) => j.tenantId === tenantId && j.slug === slug);
        return job ? { ...job } : null;
    }

    async list(tenantId: string): Promise<Job[]> {
        return [...this.rows.values()].filter((j) => j.tenantId === tenantId).map((j) => ({ ...j }));
    }
}
