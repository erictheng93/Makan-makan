import { describe, expect, it, vi } from "vitest";
import {
  buildApiRequestQuery,
  queryApiRequestAggregate,
} from "./analyticsEngineMetrics";

const config = {
  accountId: "acct-1",
  apiToken: "token-1",
  dataset: "makanmasak-metrics-prod",
};

describe("buildApiRequestQuery", () => {
  it("weights every aggregate by _sample_interval", () => {
    const sql = buildApiRequestQuery(config);

    // Analytics Engine samples under load, so a bare COUNT()/AVG() under-reports
    // once sampling starts. Every aggregate has to carry the weight.
    expect(sql).toContain("SUM(_sample_interval) AS totalRequests");
    expect(sql).toContain(
      "SUM(_sample_interval * double2) / SUM(_sample_interval)",
    );
    expect(sql).toContain(
      "QUANTILEEXACTWEIGHTED(0.95)(double2, _sample_interval)",
    );
    expect(sql).not.toMatch(/\bCOUNT\(\)/);
    expect(sql).not.toMatch(/\bAVG\(double2\)/);
  });

  it("quotes the hyphenated dataset name and filters to api_request", () => {
    const sql = buildApiRequestQuery(config);

    // Double quotes, not backticks. The SQL API rejects backticks outright:
    //   422 Input was invalid: sql parser error: Expected identifier, found: `
    expect(sql).toContain('FROM "makanmasak-metrics-prod"');
    expect(sql).not.toContain("`");
    expect(sql).toContain("blob1 = 'api_request'");
  });

  // Regression: this used toUInt32OrZero to compare status codes numerically,
  // which the SQL API rejects with `unknown function call`. The only documented
  // cast, toUInt8, cannot represent 5xx. Match on the leading digit instead.
  it("matches status codes with LIKE rather than a numeric cast", () => {
    const sql = buildApiRequestQuery(config);

    expect(sql).toContain("blob10 LIKE '4%' OR blob10 LIKE '5%'");
    expect(sql).toContain("blob10 LIKE '5%'");
    expect(sql).not.toMatch(/toUInt\d*(OrZero)?\(/i);
  });

  it("honours the window and slow-request threshold", () => {
    const sql = buildApiRequestQuery({
      ...config,
      windowHours: 6,
      slowRequestThresholdMs: 250,
    });

    expect(sql).toContain("INTERVAL '6' HOUR");
    expect(sql).toContain("IF(double2 > 250, _sample_interval, 0)");
  });
});

describe("queryApiRequestAggregate", () => {
  function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as unknown as Response;
  }

  it("posts raw SQL with a bearer token and maps the first row", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            totalRequests: "1500",
            averageResponseTime: "42.5",
            p95ResponseTime: "120",
            p99ResponseTime: "310",
            slowRequestCount: "12",
            errorCount: "30",
            criticalErrorCount: "3",
          },
        ],
      }),
    );

    const result = await queryApiRequestAggregate({ ...config, fetchImpl });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct-1/analytics_engine/sql",
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token-1",
    );
    // The SQL API takes the query as the raw body, not JSON-wrapped.
    expect(typeof init.body).toBe("string");
    expect(init.body as string).toContain("SELECT");

    // Numbers come back as strings and must be coerced.
    expect(result).toEqual({
      totalRequests: 1500,
      averageResponseTime: 42.5,
      p95ResponseTime: 120,
      p99ResponseTime: 310,
      slowRequestCount: 12,
      errorCount: 30,
      criticalErrorCount: 3,
    });
  });

  it("returns null when the dataset has no rows yet", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: [] }));

    await expect(
      queryApiRequestAggregate({ ...config, fetchImpl }),
    ).resolves.toBeNull();
  });

  it("throws on a failed query so the caller can fall back to zeroes", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ errors: ["bad sql"] }, false, 400),
    );

    await expect(
      queryApiRequestAggregate({ ...config, fetchImpl }),
    ).rejects.toThrow(/400/);
  });

  it("coerces missing or non-numeric fields to zero rather than NaN", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: [{ totalRequests: null }] }),
    );

    const result = await queryApiRequestAggregate({ ...config, fetchImpl });

    expect(result).toMatchObject({
      totalRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
    });
    expect(Object.values(result!).every((v) => Number.isFinite(v))).toBe(true);
  });
});
