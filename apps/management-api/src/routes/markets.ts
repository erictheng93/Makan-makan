import { Hono } from "hono";
import type { ManagementEnv } from "../types";

const marketsRouter = new Hono<{ Bindings: ManagementEnv }>();
const adminMarketsRouter = new Hono<{ Bindings: ManagementEnv }>();

marketsRouter.get("/", (c) => {
  const page = Math.max(parseInt(c.req.query("page") || "1", 10), 1);
  const limit = Math.min(
    Math.max(parseInt(c.req.query("limit") || "50", 10), 1),
    100,
  );

  return c.json({
    success: true,
    data: {
      markets: [],
      total: 0,
      page,
      limit,
    },
  });
});

adminMarketsRouter.get("/join-requests", (c) => {
  return c.json({
    success: true,
    data: {
      requests: [],
      status: c.req.query("status"),
    },
  });
});

adminMarketsRouter.get("/vendor-candidates", (c) => {
  return c.json({
    success: true,
    data: {
      restaurants: [],
      total: 0,
      query: c.req.query("q") ?? "",
    },
  });
});

export { marketsRouter, adminMarketsRouter };
