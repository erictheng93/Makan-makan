import { describe, expect, it, vi } from "vitest";
import { cleanupExpiredUsageEvents } from "../usage-events-ttl";
import type { Env } from "../../types/env";

describe("cleanupExpiredUsageEvents", () => {
  it("deletes only aggregated usage events older than the TTL", async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 12 } });
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    const env = { DB: { prepare } } as unknown as Env;

    const result = await cleanupExpiredUsageEvents(
      env,
      100 * 24 * 60 * 60 * 1000,
    );

    expect(result.deleted).toBe(12);
    expect(bind).toHaveBeenCalledWith(10 * 24 * 60 * 60 * 1000);
    expect((prepare.mock.calls[0] as unknown as [string])[0]).toContain(
      "aggregated_at_ms IS NOT NULL",
    );
  });
});
