import { beforeEach, describe, expect, it, vi } from "vitest";
import { VersionSyncService, type BatchUpdatePlan } from "./VersionSyncService";

function createKV() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

function createDbReturning(rows: Record<string, unknown>[]) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        all: vi.fn(async () => ({ results: rows })),
      })),
      all: vi.fn(async () => ({ results: rows })),
    })),
  };
}

function makePlan(overrides: Partial<BatchUpdatePlan> = {}): BatchUpdatePlan {
  return {
    id: "plan-1",
    targetVersion: "1.2.0",
    strategy: "all_at_once",
    tenantIds: ["t1"],
    status: "planned",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("VersionSyncService.executeBatchUpdatePlan progress persistence (#21)", () => {
  let kv: ReturnType<typeof createKV>;

  beforeEach(() => {
    kv = createKV();
  });

  function buildService(rows: Record<string, unknown>[]) {
    const env = {
      CACHE_KV: kv,
      MANAGEMENT_DB: createDbReturning(rows),
    } as never;
    const service = new VersionSyncService(env);
    // Stub the provisioning dependency so no real deployment is attempted.
    (
      service as unknown as { provisioningService: unknown }
    ).provisioningService = {
      deployToTenant: vi.fn(async () => ({ deploymentId: "dep-1" })),
    };
    return service;
  }

  it("writes update_progress:{planId} so the progress endpoint can read it", async () => {
    await kv.put("update_plan:plan-1", JSON.stringify(makePlan()));
    const service = buildService([
      { id: "t1", business_name: "Tenant One", status: "active" },
    ]);

    const progress = await service.executeBatchUpdatePlan("plan-1");

    // Progress was persisted under the key the GET route reads.
    expect(kv.store.has("update_progress:plan-1")).toBe(true);
    expect(progress.completedTenants).toBe(1);

    const readBack = await service.getUpdatePlanProgress("plan-1");
    expect(readBack).not.toBeNull();
    expect(readBack?.planId).toBe("plan-1");
    expect(readBack?.completedTenants).toBe(1);
    expect(readBack?.pendingTenants).toBe(0);
  });

  it("marks the plan completed after a successful run", async () => {
    await kv.put("update_plan:plan-1", JSON.stringify(makePlan()));
    const service = buildService([
      { id: "t1", business_name: "Tenant One", status: "active" },
    ]);

    await service.executeBatchUpdatePlan("plan-1");

    const planRow = JSON.parse(kv.store.get("update_plan:plan-1") as string);
    expect(planRow.status).toBe("completed");
    expect(planRow.completedAt).toBeTruthy();
  });

  it("records failed tenants in the persisted progress", async () => {
    await kv.put("update_plan:plan-1", JSON.stringify(makePlan()));
    const service = buildService([
      { id: "t1", business_name: "Tenant One", status: "active" },
    ]);
    (
      service as unknown as {
        provisioningService: { deployToTenant: ReturnType<typeof vi.fn> };
      }
    ).provisioningService.deployToTenant.mockRejectedValueOnce(
      new Error("deploy boom"),
    );

    const progress = await service.executeBatchUpdatePlan("plan-1");

    expect(progress.failedTenants).toBe(1);
    const readBack = await service.getUpdatePlanProgress("plan-1");
    expect(readBack?.failedTenants).toBe(1);
    expect(readBack?.results[0].status).toBe("failed");
  });
});
