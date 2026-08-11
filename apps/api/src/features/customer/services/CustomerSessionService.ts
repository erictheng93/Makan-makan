import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import type { Env } from "../../../types/env";

export const CUSTOMER_ACCESS_TOKEN_SECONDS = 15 * 60;
export const CUSTOMER_REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
export const CUSTOMER_REFRESH_COOKIE = "__Host-mm_customer_refresh";

const CUSTOMER_BINDING_TOKEN_SECONDS = 10 * 60;

export function customerRefreshRecordKey(
  customerId: string,
  refreshJti: string,
): string {
  return `customer_refresh:${customerId}:${refreshJti}`;
}

export async function issueCustomerSession(
  c: Context<{ Bindings: Env }>,
  customerId: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const refreshId = crypto.randomUUID();
  const accessToken = await sign(
    {
      sub: customerId,
      type: "customer",
      iat: now,
      exp: now + CUSTOMER_ACCESS_TOKEN_SECONDS,
    },
    c.env.JWT_SECRET,
  );
  const refreshToken = await sign(
    {
      sub: customerId,
      type: "customer_refresh",
      jti: refreshId,
      iat: now,
      exp: now + CUSTOMER_REFRESH_TOKEN_SECONDS,
    },
    c.env.JWT_SECRET,
  );

  await c.env.TOKEN_BLACKLIST.put(
    customerRefreshRecordKey(customerId, refreshId),
    "1",
    {
      expirationTtl: CUSTOMER_REFRESH_TOKEN_SECONDS,
    },
  );

  setCookie(c, CUSTOMER_REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: CUSTOMER_REFRESH_TOKEN_SECONDS,
  });

  return {
    accessToken,
    expiresIn: CUSTOMER_ACCESS_TOKEN_SECONDS,
  };
}

export async function revokeCustomerSession(
  c: Context<{ Bindings: Env }>,
  refreshJti: string | null | undefined,
  customerId?: string,
): Promise<void> {
  if (refreshJti && customerId) {
    await revokeRefreshRecord(c.env, customerId, refreshJti);
  }

  deleteCookie(c, CUSTOMER_REFRESH_COOKIE, {
    secure: true,
    sameSite: "Lax",
    path: "/",
  });
}

export async function revokeRefreshRecord(
  env: Pick<Env, "TOKEN_BLACKLIST">,
  customerId: string,
  refreshJti: string,
): Promise<void> {
  await env.TOKEN_BLACKLIST.delete(
    customerRefreshRecordKey(customerId, refreshJti),
  );
}

export async function issueBindingToken(
  env: Pick<Env, "JWT_SECRET">,
  pending: { provider: string; providerUid: string },
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      type: "customer_bind",
      provider: pending.provider,
      providerUid: pending.providerUid,
      iat: now,
      exp: now + CUSTOMER_BINDING_TOKEN_SECONDS,
    },
    env.JWT_SECRET,
  );
}
