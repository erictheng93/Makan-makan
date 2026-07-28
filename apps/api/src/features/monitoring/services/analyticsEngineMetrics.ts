/**
 * Reads aggregated API request metrics back out of Workers Analytics Engine.
 *
 * The write side already exists: advancedAnalyticsMiddleware records one
 * `api_request` data point per request inside waitUntil. This is the matching
 * read side, replacing the per-request KV write that used to stand in for it.
 *
 * Field mapping comes from AdvancedAnalyticsService.recordEvent, where the
 * arrays are zero-indexed but Analytics Engine names the columns from 1:
 *
 *   blobs[0]  -> blob1   event name ("api_request")
 *   blobs[7]  -> blob8   endpoint
 *   blobs[9]  -> blob10  status code
 *   doubles[1] -> double2 response time in ms
 */

export interface ApiRequestAggregate {
  totalRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  slowRequestCount: number;
  errorCount: number;
  criticalErrorCount: number;
}

export interface AnalyticsEngineQueryConfig {
  accountId: string;
  apiToken: string;
  dataset: string;
  /** How far back to aggregate. Defaults to one hour. */
  windowHours?: number;
  /** A request slower than this counts as slow. Defaults to 1000ms. */
  slowRequestThresholdMs?: number;
  fetchImpl?: typeof fetch;
}

const SQL_API = "https://api.cloudflare.com/client/v4/accounts";

/**
 * Every aggregate is weighted by _sample_interval. Analytics Engine samples
 * under load, so a bare COUNT()/AVG() silently under-reports once sampling
 * kicks in — the row count is not the request count.
 */
export function buildApiRequestQuery(config: AnalyticsEngineQueryConfig) {
  const windowHours = config.windowHours ?? 1;
  const slowMs = config.slowRequestThresholdMs ?? 1000;

  // Two things here came out of production 422s rather than the docs:
  //
  //   - The dataset name contains hyphens so it must be quoted, and with
  //     double quotes. Backticks are rejected:
  //       sql parser error: Expected identifier, found: `
  //   - Status codes are matched with LIKE rather than cast to a number.
  //     toUInt32OrZero does not exist here (`unknown function call`), and the
  //     one documented cast, toUInt8, tops out at 255 — below the 5xx range.
  return `
    SELECT
      SUM(_sample_interval) AS totalRequests,
      SUM(_sample_interval * double2) / SUM(_sample_interval) AS averageResponseTime,
      QUANTILEEXACTWEIGHTED(0.95)(double2, _sample_interval) AS p95ResponseTime,
      QUANTILEEXACTWEIGHTED(0.99)(double2, _sample_interval) AS p99ResponseTime,
      SUM(IF(double2 > ${slowMs}, _sample_interval, 0)) AS slowRequestCount,
      SUM(IF(blob10 LIKE '4%' OR blob10 LIKE '5%', _sample_interval, 0)) AS errorCount,
      SUM(IF(blob10 LIKE '5%', _sample_interval, 0)) AS criticalErrorCount
    FROM "${config.dataset}"
    WHERE blob1 = 'api_request'
      AND timestamp > NOW() - INTERVAL '${windowHours}' HOUR
    FORMAT JSON
  `.trim();
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Returns null rather than throwing when the query cannot be run or answered.
 * Monitoring must never be the reason a request fails, so every caller treats
 * null as "no data yet" and falls back to zeroed metrics.
 */
export async function queryApiRequestAggregate(
  config: AnalyticsEngineQueryConfig,
): Promise<ApiRequestAggregate | null> {
  const doFetch = config.fetchImpl ?? fetch;

  const response = await doFetch(
    `${SQL_API}/${config.accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        "Content-Type": "text/plain",
      },
      body: buildApiRequestQuery(config),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Analytics Engine query failed: ${response.status} ${await response
        .text()
        .catch(() => "")}`.trim(),
    );
  }

  const payload = (await response.json()) as { data?: unknown[] };
  const row = payload.data?.[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    totalRequests: toNumber(row.totalRequests),
    averageResponseTime: toNumber(row.averageResponseTime),
    p95ResponseTime: toNumber(row.p95ResponseTime),
    p99ResponseTime: toNumber(row.p99ResponseTime),
    slowRequestCount: toNumber(row.slowRequestCount),
    errorCount: toNumber(row.errorCount),
    criticalErrorCount: toNumber(row.criticalErrorCount),
  };
}
