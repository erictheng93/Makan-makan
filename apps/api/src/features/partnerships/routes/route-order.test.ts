/**
 * Regression coverage for a routing-collision bug discovered while auditing
 * module gating on GET /plans (bug-inventory lead C).
 *
 * Hono resolves a same-depth static-vs-dynamic path collision by
 * REGISTRATION ORDER, not specificity (verified directly against this repo's
 * Hono version — a literal route registered after a dynamic route at the
 * same depth is permanently unreachable). GET "/:id" (partnership detail)
 * used to be registered before the single-segment literal routes GET
 * "/plans", GET "/members", and GET "/usage", which meant every request to
 * those three list endpoints was actually swallowed by the "/:id" handler
 * (id="plans"/"members"/"usage"), failed idParamSchema's uuid check, and
 * error'd out — all three list endpoints were silently unreachable in
 * production. The fix moves GET "/:id" to the end of the file, after every
 * single-segment literal GET. This file proves each literal route now wins.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.hoisted(() => ({
  value: { id: 1, role: 0, restaurantId: undefined as string | undefined },
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", currentUser.value);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

const serviceFns = vi.hoisted(() => ({
  listPlans: vi.fn(),
  listMembers: vi.fn(),
  listUsageLogs: vi.fn(),
  getPartnership: vi.fn(),
}));

vi.mock("@makanmakan/database", () => ({
  PartnershipService: class {
    listPlans = serviceFns.listPlans;
    listMembers = serviceFns.listMembers;
    listUsageLogs = serviceFns.listUsageLogs;
    getPartnership = serviceFns.getPartnership;
  },
}));

import routes from "./index";
import { ApiError } from "../../../shared/utils/api-error";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

const env = { DB: {}, CACHE_KV: {} } as never;

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.value = { id: 1, role: 0, restaurantId: undefined };
});

describe("single-segment literal GET routes are not shadowed by GET /:id", () => {
  it("GET /plans resolves to the plans list handler, not the partnership-detail handler", async () => {
    serviceFns.listPlans.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0 },
    });

    const res = await routes.fetch(new Request("https://test/plans"), env);

    expect(res.status).toBe(200);
    expect(serviceFns.listPlans).toHaveBeenCalledOnce();
    expect(serviceFns.getPartnership).not.toHaveBeenCalled();
  });

  it("GET /members resolves to the members list handler, not the partnership-detail handler", async () => {
    serviceFns.listMembers.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0 },
    });

    const res = await routes.fetch(new Request("https://test/members"), env);

    expect(res.status).toBe(200);
    expect(serviceFns.listMembers).toHaveBeenCalledOnce();
    expect(serviceFns.getPartnership).not.toHaveBeenCalled();
  });

  it("GET /usage resolves to the usage-log list handler, not the partnership-detail handler", async () => {
    serviceFns.listUsageLogs.mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0 },
    });

    const res = await routes.fetch(new Request("https://test/usage"), env);

    expect(res.status).toBe(200);
    expect(serviceFns.listUsageLogs).toHaveBeenCalledOnce();
    expect(serviceFns.getPartnership).not.toHaveBeenCalled();
  });

  it("GET /:id (an actual uuid) still resolves to the partnership-detail handler", async () => {
    const partnershipId = "11111111-1111-4111-8111-111111111111";
    serviceFns.getPartnership.mockResolvedValue({ id: partnershipId });

    const res = await routes.fetch(
      new Request(`https://test/${partnershipId}`),
      env,
    );

    expect(res.status).toBe(200);
    expect(serviceFns.getPartnership).toHaveBeenCalledWith(partnershipId);
  });
});
