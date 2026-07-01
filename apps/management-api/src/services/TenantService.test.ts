import { describe, expect, it } from "vitest";
import { TenantService } from "./TenantService";
import type { ManagementEnv } from "../types";

function createEnvWithAvailableSubdomains(): ManagementEnv {
  return {
    MANAGEMENT_DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => null,
        }),
      }),
    },
  } as unknown as ManagementEnv;
}

describe("TenantService", () => {
  it("romanizes CJK business names when generating available subdomains", async () => {
    const service = new TenantService(createEnvWithAvailableSubdomains());

    await expect(
      service.generateAvailableSubdomain("日式料理"),
    ).resolves.toMatch(/^ri-shi-liao-li-[a-z0-9]{6}$/);
  });
});
