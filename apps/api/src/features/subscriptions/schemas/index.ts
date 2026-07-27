import { z } from "zod";
import { PLAN_TIERS, MODULES } from "@makanmakan/database";

const planTierEnum = z.enum([
  PLAN_TIERS.TRIAL,
  PLAN_TIERS.BASIC,
  PLAN_TIERS.PRO,
  PLAN_TIERS.ENTERPRISE,
]);

const moduleKeyEnum = z.enum(Object.values(MODULES) as [string, ...string[]]);

export const createSubscriptionSchema = z.object({
  restaurantId: z.string().min(1),
  planTier: planTierEnum,
  trialEndsAt: z.string().datetime().optional(),
  billingCycleStartAt: z.string().datetime().optional(),
  billingCycleEndAt: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const updateModulesSchema = z.object({
  overrides: z.record(moduleKeyEnum, z.boolean().nullable()),
});

export const changePlanSchema = z.object({
  planTier: planTierEnum,
});

export const setActiveSchema = z.object({
  isActive: z.boolean(),
});
