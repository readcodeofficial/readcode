import type { JobService, TenantContext } from "./jobService.ts";

export interface Application {
    id: string;
    tenantId: string;
    jobId: string;
    candidateEmail: string;
    resumeText: string;
}

export interface ApplicationStore {
    add(app: Application): Promise<void>;
    forTenant(tenantId: string): Promise<Application[]>;
}

// POST /careers/:slug/apply on a company's careers site.
export async function applyToJob(
    jobs: JobService,
    store: ApplicationStore,
    ctx: TenantContext,
    slug: string,
    candidate: { email: string; resumeText: string },
    newId: () => string,
): Promise<Application> {
    if (!/^[^@\s]+@[^@\s]+$/.test(candidate.email)) throw new Error("invalid email");
    const job = await jobs.getOpenBySlug(ctx, slug);
    const app: Application = {
        id: newId(),
        tenantId: job.tenantId,
        jobId: job.id,
        candidateEmail: candidate.email,
        resumeText: candidate.resumeText,
    };
    await store.add(app);
    return app;
}

// The recruiter inbox only ever shows the signed-in recruiter's own company.
export async function inbox(store: ApplicationStore, ctx: TenantContext): Promise<Application[]> {
    return store.forTenant(ctx.tenantId);
}
