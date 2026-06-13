import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import { ApiError } from "@makanmakan/utils";
import { managementAuthMiddleware } from "../middleware/auth";
import type { ManagementEnv } from "../types";
import authRouter from "./auth";

const JWT_SECRET = "test-jwt-secret-with-at-least-32-chars";
const MANAGEMENT_JWT_SECRET = "management-jwt-secret-with-at-least-32-chars";

type TestEnv = {
  Bindings: ManagementEnv;
  Variables: {
    managementUser: {
      id: string;
      email: string;
      role: "admin";
    };
  };
};

function createApp() {
  const app = new Hono<TestEnv>();
  app.onError((error, c) => {
    if (error instanceof ApiError) {
      return c.json(
        { error: error.code, message: error.message },
        error.status as never,
      );
    }
    throw error;
  });
  app.route("/auth", authRouter);
  app.use("/admin", managementAuthMiddleware);
  app.get("/admin", (c) => c.json({ user: c.get("managementUser") }));
  return app;
}

async function createApiToken(payload: Record<string, unknown>) {
  return sign(
    {
      id: 7,
      username: "platform-admin",
      role: 0,
      restaurantId: null,
      tv: 1,
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payload,
    },
    JWT_SECRET,
  );
}

describe("management auth exchange", () => {
  it("exchanges a real API admin token shape for a middleware-accepted management token", async () => {
    const app = createApp();
    const apiToken = await createApiToken({});
    const env = { JWT_SECRET, MANAGEMENT_JWT_SECRET } as never;

    const exchangeResponse = await app.fetch(
      new Request("https://management.test/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: apiToken }),
      }),
      env,
    );

    expect(exchangeResponse.status).toBe(200);
    const exchangeBody = (await exchangeResponse.json()) as {
      data: { token: string };
    };

    const protectedResponse = await app.fetch(
      new Request("https://management.test/admin", {
        headers: {
          Authorization: `Bearer ${exchangeBody.data.token}`,
        },
      }),
      env,
    );

    expect(protectedResponse.status).toBe(200);
    await expect(protectedResponse.json()).resolves.toMatchObject({
      user: {
        id: "7",
        email: "platform-admin",
        role: "admin",
      },
    });
  });

  it("does not exchange non-admin API tokens", async () => {
    const app = createApp();
    const apiToken = await createApiToken({ role: 1 });

    const response = await app.fetch(
      new Request("https://management.test/auth/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: apiToken }),
      }),
      { JWT_SECRET, MANAGEMENT_JWT_SECRET } as never,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      message: "Admin API token required",
    });
  });
});
