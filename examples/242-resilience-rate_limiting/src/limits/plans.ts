export type Plan = "trial" | "standard" | "enterprise";

export interface PlanLimits {
    burst: number; // message segments that can be sent back to back
    perSecond: number; // sustained segments per second
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
    trial: { burst: 5, perSecond: 1 },
    standard: { burst: 30, perSecond: 10 },
    enterprise: { burst: 200, perSecond: 100 },
};
