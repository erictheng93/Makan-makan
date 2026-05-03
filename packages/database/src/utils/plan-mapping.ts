import { PLAN_TIERS, type PlanTier } from "../schema/subscriptions";

export const PLAN_ID_TO_TIER: Record<string, PlanTier> = {
  standard: PLAN_TIERS.BASIC,
  professional: PLAN_TIERS.PRO,
  enterprise: PLAN_TIERS.ENTERPRISE,
};

export const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
export const DEFAULT_BILLING_CYCLE_MS = 30 * 24 * 60 * 60 * 1000;

export function planIdToTier(planId: string | null | undefined): PlanTier {
  return planId
    ? (PLAN_ID_TO_TIER[planId] ?? PLAN_TIERS.TRIAL)
    : PLAN_TIERS.TRIAL;
}
