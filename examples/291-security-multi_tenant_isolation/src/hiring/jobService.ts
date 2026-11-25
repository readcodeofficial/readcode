import type { Job, JobRepo } from "./jobRepo.ts";
import { TtlCache } from "./ttlCache.ts";

export interface TenantContext {
    tenantId: string; // resolved from the careers-page host or the recruiter's session, never from the body
    userId?: string;
}

export class NotFoundError extends Error {
    constructor(what: string) {
        super(`${what} not found`);
        this.name = "NotFoundError";
    }
}

// Job postings for many customer companies. Careers pages hit getOpenBySlug on every page
// view, so slug lookups are cached for a minute.
export class JobService {
    private readonly repo: JobRepo;
    private readonly bySlug: TtlCache<Job | null>;

    constructor(repo: JobRepo, now: () => number) {
        this.repo = repo;
        this.bySlug = new TtlCache(60_000, now);
    }

    async getOpenBySlug(ctx: TenantContext, slug: string): Promise<Job> {
        const job = await this.bySlug.getOrLoad(slug, () => this.repo.bySlug(ctx.tenantId, slug));
        if (!job || job.status !== "open") throw new NotFoundError(`job ${slug}`);
        return job;
    }

    async listOpen(ctx: TenantContext): Promise<Job[]> {
        return (await this.repo.list(ctx.tenantId)).filter((j) => j.status === "open");
    }

    async upsert(ctx: TenantContext, job: Omit<Job, "tenantId">): Promise<Job> {
        const previous = await this.repo.byId(ctx.tenantId, job.id);
        const saved: Job = { ...job, tenantId: ctx.tenantId };
        await this.repo.save(saved);
        if (previous && previous.slug !== saved.slug) this.bySlug.delete(previous.slug);
        this.bySlug.delete(saved.slug);
        return saved;
    }
}
