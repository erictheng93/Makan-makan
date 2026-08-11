import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it } from "vitest";
import { ApiError } from "@makanmasak/utils";
import { managementAuthMiddleware, type ManagementUser } from "./auth";
import type { ManagementEnv } from "../types";

const JWT_SECRET = "test-jwt-secret-with-at-least-32-chars";
const MANAGEMENT_JWT_SECRET = "management-jwt-secret-with-at-least-32-chars";

type TestEnv = {
  Bindings: ManagementEnv;
  Variables: { managementUser: ManagementUser };
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
  app.use("/admin", managementAuthMiddleware);
  app.get("/admin", (c) => c.json({ user: c.get("managementUser") }));
  return app;
}

async function token(payload: Record<string, unknown>) {
  return sign(
    {
      id: "admin-1",
      email: "admin@example.com",
      aud: "management",
      iss: "makanmakan-management",
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...payload,
    },
    JWT_SECRET,
  );
}

describe("managementAuthMiddleware", () => {
  it("accepts platform admin JWTs", async () => {
    const app = createApp();

    const response = await app.fetch(
      new Request("https://management.test/admin", {
        headers: { Authorization: `Bearer ${await token({ role: "admin" })}` },
      }),
      { JWT_SECRET } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    });
    expect(response.status).toBe(200);
  });

  it("accepts management JWTs signed with the dedicated management secret", async () => {
    const app = createApp();

    const signed = await sign(
      {
        id: "admin-1",
        email: "admin@example.com",
        role: "admin",
        aud: "management",
        iss: "makanmakan-management",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      MANAGEMENT_JWT_SECRET,
    );

    const response = await app.fetch(
      new Request("https://management.test/admin", {
        headers: { Authorization: `Bearer ${signed}` },
      }),
      { JWT_SECRET, MANAGEMENT_JWT_SECRET } as never,
    );

    expect(response.status).toBe(200);
  });

  it("rejects API admin JWTs without management audience and issuer", async () => {
    const app = createApp();
    const apiAdminToken = await sign(
      {
        id: "admin-1",
        email: "admin@example.com",
        role: "admin",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      JWT_SECRET,
    );

    const response = await app.fetch(
      new Request("https://management.test/admin", {
        headers: { Authorization: `Bearer ${apiAdminToken}` },
      }),
      { JWT_SECRET } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      message: "Invalid token claims",
    });
    expect(response.status).toBe(401);
  });

  it("rejects non-admin JWTs", async () => {
    const app = createApp();

    const response = await app.fetch(
      new Request("https://management.test/admin", {
        headers: { Authorization: `Bearer ${await token({ role: "owner" })}` },
      }),
      { JWT_SECRET } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      message: "Invalid token claims",
    });
    expect(response.status).toBe(401);
  });
});
