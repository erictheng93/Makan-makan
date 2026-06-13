import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { badRequest, unauthorized } from "@makanmakan/utils";
import type { ManagementEnv } from "../types";
import {
  MANAGEMENT_JWT_AUDIENCE,
  MANAGEMENT_JWT_ISSUER,
  hasPlatformAdminClaim,
  managementJwtSecret,
} from "../middleware/auth";

const MANAGEMENT_TOKEN_TTL_SECONDS = 60 * 60;

const authRouter = new Hono<{ Bindings: ManagementEnv }>();

function getRequiredApiToken(body: unknown): string {
  if (
    !body ||
    typeof body !== "object" ||
    typeof (body as { token?: unknown }).token !== "string" ||
    !(body as { token: string }).token.trim()
  ) {
    throw badRequest("token is required");
  }

  return (body as { token: string }).token.trim();
}

function getManagementSubject(payload: Record<string, unknown>): {
  id: string;
  email: string;
} {
  if (!hasPlatformAdminClaim(payload)) {
    throw unauthorized("Admin API token required");
  }

  if (typeof payload.id !== "string" && typeof payload.id !== "number") {
    throw unauthorized("Invalid API token subject");
  }

  const email =
    typeof payload.email === "string" && payload.email.trim()
      ? payload.email.trim()
      : typeof payload.username === "string" && payload.username.trim()
        ? payload.username.trim()
        : null;

  if (!email) {
    throw unauthorized("Invalid API token identity");
  }

  return {
    id: String(payload.id),
    email,
  };
}

authRouter.post("/exchange", async (c) => {
  const body = await c.req.json().catch(() => null);
  const apiToken = getRequiredApiToken(body);

  let apiPayload: Record<string, unknown>;
  try {
    apiPayload = await verify(apiToken, c.env.JWT_SECRET, "HS256");
  } catch {
    throw unauthorized("Invalid or expired API token");
  }

  const subject = getManagementSubject(apiPayload);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + MANAGEMENT_TOKEN_TTL_SECONDS;
  const token = await sign(
    {
      id: subject.id,
      email: subject.email,
      role: "admin",
      aud: MANAGEMENT_JWT_AUDIENCE,
      iss: MANAGEMENT_JWT_ISSUER,
      iat: now,
      exp: expiresAt,
    },
    managementJwtSecret(c.env),
  );

  return c.json({
    success: true,
    data: {
      token,
      tokenType: "Bearer",
      expiresAt,
    },
  });
});

export default authRouter;
