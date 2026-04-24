import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { D1Database } from "@makanmakan/database";
import {
  shopSubscriptions,
  PLAN_DEFAULT_MODULES,
  type ModuleKey,
  type ModuleMap,
  type PlanTier,
} from "@makanmakan/database";
import { notFound, conflict } from "../../../shared/utils/api-error";

export interface CreateSubscriptionInput {
  restaurantId: string;
  planTier: PlanTier;
  trialEndsAt?: Date;
  billingCycleStartAt?: Date;
  billingCycleEndAt?: Date;
  notes?: string;
}

export interface UpdateModulesInput {
  /** Partial overrides to merge into existing moduleOverrides */
  overrides: ModuleMap;
}

export class SubscriptionService {
  private db: ReturnType<typeof drizzle>;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async getByRestaurantId(
    restaurantId: string,
  ): Promise<typeof shopSubscriptions.$inferSelect | null> {
    const [row] = await this.db
      .select()
      .from(shopSubscriptions)
      .where(eq(shopSubscriptions.restaurantId, restaurantId))
      .limit(1);

    return row ?? null;
  }

  async listAll() {
    return this.db
      .select()
      .from(shopSubscriptions)
      .orderBy(shopSubscriptions.createdAt);
  }

  async create(input: CreateSubscriptionInput) {
    const existing = await this.getByRestaurantId(input.restaurantId);
    if (existing) {
      throw conflict(
        "Subscription already exists for this restaurant",
        "SUBSCRIPTION_EXISTS",
      );
    }

    const [created] = await this.db
      .insert(shopSubscriptions)
      .values({
        restaurantId: input.restaurantId,
        planTier: input.planTier,
        moduleOverrides: {},
        isActive: true,
        trialEndsAt: input.trialEndsAt,
        billingCycleStartAt: input.billingCycleStartAt,
        billingCycleEndAt: input.billingCycleEndAt,
        notes: input.notes,
      })
      .returning();

    return created;
  }

  /**
   * Merge the provided overrides into the existing moduleOverrides map.
   * Set a key to `true` to grant, `false` to revoke, or `undefined` to reset to plan default.
   */
  async updateModules(restaurantId: string, input: UpdateModulesInput) {
    const sub = await this.getByRestaurantId(restaurantId);
    if (!sub)
      throw notFound("Subscription not found", "SUBSCRIPTION_NOT_FOUND");

    const merged: ModuleMap = {
      ...(sub.moduleOverrides ?? {}),
      ...input.overrides,
    };

    // Remove keys explicitly set to undefined (reset to plan default)
    for (const key of Object.keys(merged) as ModuleKey[]) {
      if (merged[key] === undefined) delete merged[key];
    }

    const [updated] = await this.db
      .update(shopSubscriptions)
      .set({ moduleOverrides: merged })
      .where(eq(shopSubscriptions.restaurantId, restaurantId))
      .returning();

    return updated;
  }

  /** Upgrade/downgrade the plan tier and reset module overrides to the new plan defaults */
  async changePlan(restaurantId: string, planTier: PlanTier) {
    const sub = await this.getByRestaurantId(restaurantId);
    if (!sub)
      throw notFound("Subscription not found", "SUBSCRIPTION_NOT_FOUND");

    const [updated] = await this.db
      .update(shopSubscriptions)
      .set({ planTier, moduleOverrides: {} })
      .where(eq(shopSubscriptions.restaurantId, restaurantId))
      .returning();

    return updated;
  }

  /** Kill switch — immediately locks or unlocks the entire shop */
  async setActive(restaurantId: string, isActive: boolean) {
    const sub = await this.getByRestaurantId(restaurantId);
    if (!sub)
      throw notFound("Subscription not found", "SUBSCRIPTION_NOT_FOUND");

    const [updated] = await this.db
      .update(shopSubscriptions)
      .set({ isActive })
      .where(eq(shopSubscriptions.restaurantId, restaurantId))
      .returning();

    return updated;
  }

  /** Compute the effective module list (plan defaults merged with overrides) */
  getEffectiveModules(
    sub: typeof shopSubscriptions.$inferSelect,
  ): Record<ModuleKey, boolean> {
    const planDefaults = PLAN_DEFAULT_MODULES[sub.planTier as PlanTier] ?? {};
    const overrides = (sub.moduleOverrides ?? {}) as ModuleMap;

    const allKeys = new Set([
      ...Object.keys(planDefaults),
      ...Object.keys(overrides),
    ]) as Set<ModuleKey>;

    const result = {} as Record<ModuleKey, boolean>;
    for (const key of allKeys) {
      result[key] = overrides[key] ?? planDefaults[key] ?? false;
    }
    return result;
  }
}
