import { describe, expect, it } from "vitest";
import {
  buildApiRequestQuery,
  queryApiRequestAggregate,
} from "../../features/monitoring/services/analyticsEngineMetrics";

/**
 * Sends the real aggregate query to the real Analytics Engine SQL API.
 *
 * The unit tests around this query mock `fetch`, so they only assert what the
 * SQL string looks like — they cannot tell whether Analytics Engine accepts it.
 * Every syntax problem this query has had was found from a production 422, one
 * round trip at a time:
 *
 *   - backticks around the hyphenated dataset name
 *       -> sql parser error: Expected identifier, found: `
 *   - toUInt32OrZero for the status-code comparison
 *       -> unknown function call: TOUINT32ORZERO
 *
 * A dialect change would break the query again and every unit test would still
 * pass, exactly like the `writeDataPoint` index bug that threw on every request
 * into a swallowing catch for as long as it shipped. This is the test that
 * would notice.
 */

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const dataset = process.env.ANALYTICS_DATASET;
const hasCredentials = Boolean(accountId && apiToken && dataset);

// A skipped test is indistinguishable from a passing one in a CI summary, and
// silently-skipped verification is the failure mode this whole file exists to
// prevent. The job that owns the secrets sets this so a missing or expired
// token fails loudly instead of quietly skipping.
const required = process.env.REQUIRE_ANALYTICS_ENGINE_SMOKE === "1";

describe("Analytics Engine SQL — real API", () => {
  it("has credentials when the running job declares them required", () => {
    if (!required) {
      expect(true).toBe(true);
      return;
    }
    expect(
      hasCredentials,
      "REQUIRE_ANALYTICS_ENGINE_SMOKE=1 but CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / ANALYTICS_DATASET are not all set",
    ).toBe(true);
  });

  it.skipIf(!hasCredentials)(
    "accepts the aggregate query and returns the expected columns",
    async () => {
      const config = {
        accountId: accountId!,
        apiToken: apiToken!,
        dataset: dataset!,
      };

      // Exercises the production function, not a copy of the SQL, so drift
      // between what ships and what is verified is impossible.
      const aggregate = await queryApiRequestAggregate(config);

      // A rejected query throws before this point — reaching here means the
      // SQL parsed and ran. An empty dataset legitimately yields null.
      if (aggregate === null) {
        console.warn(
          "Analytics Engine returned no rows; query is valid but the dataset is empty for the window.",
        );
        return;
      }

      expect(aggregate).toMatchObject({
        totalRequests: expect.any(Number),
        averageResponseTime: expect.any(Number),
        p95ResponseTime: expect.any(Number),
        p99ResponseTime: expect.any(Number),
        slowRequestCount: expect.any(Number),
        errorCount: expect.any(Number),
        criticalErrorCount: expect.any(Number),
      });

      // Every field is coerced, so a column the API stopped returning shows up
      // as 0 rather than NaN — assert none of them went non-finite.
      for (const [key, value] of Object.entries(aggregate)) {
        expect(Number.isFinite(value), `${key} is not finite`).toBe(true);
      }

      // Percentiles are ordered by definition; a mis-mapped column would break
      // this even while every individual value still looked numeric.
      expect(aggregate.p99ResponseTime).toBeGreaterThanOrEqual(
        aggregate.p95ResponseTime,
      );
      expect(aggregate.criticalErrorCount).toBeLessThanOrEqual(
        aggregate.errorCount,
      );
    },
  );

  it.skipIf(!hasCredentials)(
    "rejects a deliberately malformed query, proving the check can fail",
    async () => {
      // Guards the guard: if the API accepted anything we sent, a green run
      // above would mean nothing.
      const broken = {
        accountId: accountId!,
        apiToken: apiToken!,
        dataset: dataset!,
        fetchImpl: (async (url: string, init: RequestInit) =>
          fetch(url, {
            ...init,
            body: (init.body as string).replace(/FROM "/, "FROM `"),
          })) as unknown as typeof fetch,
      };

      await expect(queryApiRequestAggregate(broken)).rejects.toThrow(/422/);
    },
  );

  it("keeps the query free of constructs Analytics Engine rejects", () => {
    const sql = buildApiRequestQuery({
      accountId: "a",
      apiToken: "b",
      dataset: "makanmasak-metrics-prod",
    });

    expect(sql).not.toContain("`");
    expect(sql).not.toMatch(/toUInt\d*(OrZero)?\(/i);
  });
});
