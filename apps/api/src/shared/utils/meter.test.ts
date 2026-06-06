import { describe, expect, it, vi } from "vitest";
import { meterEmit } from "./meter";

function createContext({
  tenantId = "tenant-restaurant-1",
  user,
}: {
  tenantId?: string | null;
  user?: { role?: number | null; restaurantId?: string | number | null };
} = {}) {
  const run = vi.fn(async () => undefined);
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));

  return {
    env: {
      DB: { prepare },
    },
    get: vi.fn((key: string) => {
      if (key === "tenant" && tenantId != null) {
        return {
          mode: "saas",
          tenantId,
          enforceSingleTenant: false,
        };
      }
      if (key === "user") return user;
      return undefined;
    }),
    executionCtx: undefined,
    prepare,
    bind,
    run,
  };
}

describe("meterEmit", () => {
  it("uses tenant context when no explicit restaurant or user restaurant is present", async () => {
    const ctx = createContext();

    await meterEmit(ctx as never, "api.requests", {
      metadata: { path: "/api/v1/restaurants" },
    });

    expect(ctx.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO usage_events"),
    );
    expect(ctx.bind).toHaveBeenCalledWith(
      expect.any(String),
      "tenant-restaurant-1",
      "api.requests",
      1,
      JSON.stringify({ path: "/api/v1/restaurants" }),
    );
  });

  it("does not implicitly meter admin requests without tenant context", async () => {
    const ctx = createContext({
      tenantId: null,
      user: { role: 0, restaurantId: "1" },
    });

    await meterEmit(ctx as never, "api.requests");

    expect(ctx.prepare).not.toHaveBeenCalled();
  });
});
