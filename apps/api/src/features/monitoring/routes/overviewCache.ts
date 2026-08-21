/**
 * Edge cache for GET /monitoring/overview.
 *
 * The overview is the dashboard's per-refresh request, so its cost used to
 * scale with the number of people watching: every open dashboard spent its own
 * KV read and its own response assembly for a payload that is identical for all
 * of them. Holding one copy at the edge makes that cost a function of time
 * rather than of audience -- one origin build per TTL per colo, whether one
 * person is watching or fifty.
 *
 * SAFETY: this is a shared, unkeyed cache entry. It is sound only because the
 * overview payload is system-wide and identical for every authorised caller --
 * the handler reads no user, tenant or restaurant context. Two rules follow:
 *
 *   1. The lookup must run *after* the auth and role middleware, so an
 *      unauthorised caller is rejected before a cached body can be returned.
 *   2. If the payload ever gains per-tenant or per-user content, the cache key
 *      must gain the same dimension, or this becomes a data leak.
 *
 * The repo's EdgeCacheManager is deliberately not used here: smartCacheMiddleware
 * skips authenticated requests outright, and this route is authenticated. (It
 * also used to spend a KV read and a KV write per request on hit accounting —
 * the exact cost this is meant to remove — but that accounting has since been
 * deleted, so that is no longer a reason to avoid it.)
 */

/**
 * Bounded by HEALTH_PROBE_TTL_MS in MonitoringService so a cached overview is
 * never staler than the probe policy already allows. Raising it buys a higher
 * hit rate at the cost of reporting an outage that much later.
 */
export const OVERVIEW_CACHE_TTL_SECONDS = 10;

/**
 * Synthetic origin. The key never leaves the edge, but it has to be a URL, and
 * a real hostname would risk colliding with a cached response for the actual
 * route.
 */
const CACHE_KEY_ORIGIN = "https://monitoring-overview.cache.internal";

/** Varies on `include`: the embedded metrics change the body. */
export function buildOverviewCacheKey(include: string | undefined): Request {
  const url = new URL("/overview", CACHE_KEY_ORIGIN);
  if (include) url.searchParams.set("include", include);
  return new Request(url.toString(), { method: "GET" });
}

/** The Cache API, or undefined where it does not exist (tests, some dev runs). */
export function getEdgeCache(): Cache | undefined {
  return typeof caches === "undefined" ? undefined : caches.default;
}

/**
 * Says whether a response came from the edge. There is no way to tell from the
 * body -- a hit is byte-identical to the miss that produced it -- so without
 * this the only evidence the cache is working at all is an absence in the
 * Analytics Engine numbers.
 */
export const CACHE_STATUS_HEADER = "x-monitoring-cache";

export async function readCachedOverview(
  cache: Cache | undefined,
  include: string | undefined,
): Promise<Response | undefined> {
  if (!cache) return undefined;

  let hit: Response | undefined;
  try {
    hit = (await cache.match(buildOverviewCacheKey(include))) ?? undefined;
  } catch {
    // A cache that cannot be read is not a reason to fail the request.
    return undefined;
  }
  if (!hit) return undefined;

  // The stored copy carries no status header; it is stamped on the way out so
  // the same body can be served as a hit now and was a miss when it was built.
  const stamped = new Response(hit.body, hit);
  stamped.headers.set(CACHE_STATUS_HEADER, "hit");
  return stamped;
}

/** Headers a freshly built overview carries, matching what a hit will carry. */
export function overviewCacheHeaders(): Record<string, string> {
  return {
    "cache-control": `max-age=${OVERVIEW_CACHE_TTL_SECONDS}`,
    [CACHE_STATUS_HEADER]: "miss",
  };
}

export function writeCachedOverview(
  cache: Cache | undefined,
  waitUntil: ((promise: Promise<unknown>) => void) | undefined,
  include: string | undefined,
  body: unknown,
): void {
  if (!cache) return;

  const response = new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=UTF-8",
      // Cache API honours this for expiry. It is also what a client would see,
      // and matching the two keeps a browser from holding the body longer than
      // the edge does.
      "cache-control": `max-age=${OVERVIEW_CACHE_TTL_SECONDS}`,
    },
  });

  const write = cache
    .put(buildOverviewCacheKey(include), response)
    .catch(() => {
      // Populating the cache is best effort; the caller already has its answer.
    });

  if (waitUntil) {
    waitUntil(write);
  }
}
