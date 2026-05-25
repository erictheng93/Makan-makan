import { Hono } from "hono";
import type { Context } from "hono";
import { sign, verify } from "hono/jwt";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateUUID } from "@makanmakan/utils";
import type { Env } from "../../../types/env";
import { canonicalCustomerAuthMiddleware } from "../../../middleware/auth";
import { validateBody } from "../../../middleware/validation";
import { badRequest, unauthorized } from "../../../shared/utils/api-error";

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const phoneSchema = z.string().trim().min(7).max(20).transform(normalizePhone);

const requestOtpSchema = z.object({
  phone: phoneSchema,
});

const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().regex(/^\d{6}$/),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

const profilePatchSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  locale: z
    .string()
    .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/)
    .max(16)
    .nullable()
    .optional(),
});

const preferencesPatchSchema = z.object({
  dietaryTags: z.array(z.string().min(1).max(50)).max(50).optional(),
  allergens: z.array(z.string().min(1).max(50)).max(50).optional(),
  defaultPartySize: z.number().int().min(1).max(20).nullable().optional(),
  marketingOptIn: z.boolean().optional(),
  waitingListOptIn: z.boolean().optional(),
  promoFromFavoritesOptIn: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
});

const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .transform(decodeHtmlEntities)
    .pipe(z.string().url().max(4096)),
  p256dh: z.string().min(1).max(2048),
  auth: z.string().min(1).max(2048),
  userAgent: z.string().max(1024).optional(),
  deviceLabel: z.string().max(100).optional(),
});

const consentSchema = z.object({
  consentType: z.enum([
    "marketing",
    "analytics",
    "location",
    "data_share",
    "terms_of_service",
    "privacy_policy",
  ]),
  version: z.string().trim().min(1).max(100),
  granted: z.boolean(),
  source: z
    .enum(["onboarding", "settings", "inline_prompt"])
    .default("settings"),
});

type CustomerRow = {
  id: string;
  display_name: string;
  primary_phone: string | null;
  primary_email: string | null;
  avatar_url: string | null;
  locale: string | null;
  status: string;
  last_seen_at_ms: number | null;
  created_at_ms: number;
  updated_at_ms: number;
};

const routes = new Hono<{ Bindings: Env }>();

routes.post("/auth/request-otp", validateBody(requestOtpSchema), async (c) => {
  const { phone } = c.get("validatedBody");
  const now = Date.now();
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);

  await enforceOtpRateLimit(c.env, phone, c.req.header("CF-Connecting-IP"));

  await c.env.DB.prepare(
    `INSERT INTO customer_phone_verification_tokens
        (phone, otp_code, expires_at_ms, ip_address, created_at_ms)
       VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(phone, otpHash, now + OTP_TTL_MS, clientIp(c), now)
    .run();

  return c.json({
    success: true,
    data: {
      phone,
      expiresInSeconds: OTP_TTL_MS / 1000,
      ...(c.env.NODE_ENV === "production" ? {} : { devOtp: otp }),
    },
  });
});

routes.post("/auth/verify-otp", validateBody(verifyOtpSchema), async (c) => {
  const { phone, otp } = c.get("validatedBody");
  const now = Date.now();
  const token = await c.env.DB.prepare(
    `SELECT id, otp_code, attempts
       FROM customer_phone_verification_tokens
      WHERE phone = ?
        AND used_at_ms IS NULL
        AND expires_at_ms > ?
      ORDER BY created_at_ms DESC
      LIMIT 1`,
  )
    .bind(phone, now)
    .first<{ id: number; otp_code: string; attempts: number }>();

  if (!token || token.attempts >= MAX_OTP_ATTEMPTS) {
    throw unauthorized("Invalid or expired OTP", "INVALID_OTP");
  }

  const valid = await bcrypt.compare(otp, token.otp_code);
  if (!valid) {
    await c.env.DB.prepare(
      `UPDATE customer_phone_verification_tokens
          SET attempts = attempts + 1
        WHERE id = ?`,
    )
      .bind(token.id)
      .run();
    throw unauthorized("Invalid or expired OTP", "INVALID_OTP");
  }

  const customer = await findOrCreateCustomerByPhone(c.env, phone, now);

  await c.env.DB.prepare(
    `UPDATE customer_phone_verification_tokens
        SET used_at_ms = ?, customer_id = ?
      WHERE id = ?`,
  )
    .bind(now, customer.id, token.id)
    .run();

  const tokens = await issueCustomerTokens(c.env, customer.id);

  return c.json({
    success: true,
    data: {
      ...tokens,
      customer: toCustomerSummary(customer),
    },
  });
});

routes.post("/auth/refresh", validateBody(refreshSchema), async (c) => {
  const { refreshToken } = c.get("validatedBody");
  const decoded = await verify(refreshToken, c.env.JWT_SECRET, "HS256");
  if (!isRefreshPayload(decoded)) {
    throw unauthorized("Invalid refresh token", "TOKEN_INVALID");
  }

  const refreshKey = `customer_refresh:${decoded.jti}`;
  const customerId = await c.env.TOKEN_BLACKLIST.get(refreshKey);
  if (customerId !== decoded.sub) {
    throw unauthorized("Refresh token has been revoked", "TOKEN_INVALID");
  }

  await c.env.TOKEN_BLACKLIST.delete(refreshKey);
  const customer = await loadCustomer(c.env, decoded.sub);
  if (!customer) {
    throw unauthorized("Customer not found or inactive", "CUSTOMER_INACTIVE");
  }

  const tokens = await issueCustomerTokens(c.env, customer.id);
  return c.json({ success: true, data: tokens });
});

routes.post("/auth/logout", canonicalCustomerAuthMiddleware, async (c) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : undefined;

  if (token) {
    await c.env.TOKEN_BLACKLIST.put(`token:${token}`, "blacklisted", {
      expirationTtl: ACCESS_TOKEN_SECONDS,
    });
  }

  return c.json({ success: true, data: { loggedOut: true } });
});

routes.get("/me", canonicalCustomerAuthMiddleware, async (c) => {
  const customer = await loadCustomer(c.env, c.get("customer").id);
  const preferences = await loadPreferences(c.env, c.get("customer").id);
  return c.json({
    success: true,
    data: {
      customer: customer ? toCustomerSummary(customer) : c.get("customer"),
      preferences,
    },
  });
});

routes.patch(
  "/me",
  canonicalCustomerAuthMiddleware,
  validateBody(profilePatchSchema),
  async (c) => {
    const customer = c.get("customer");
    const body = c.get("validatedBody");
    const now = Date.now();

    await c.env.DB.prepare(
      `UPDATE customers
          SET display_name = COALESCE(?, display_name),
              avatar_url = CASE WHEN ? THEN ? ELSE avatar_url END,
              locale = CASE WHEN ? THEN ? ELSE locale END,
              updated_at_ms = ?
        WHERE id = ?`,
    )
      .bind(
        body.displayName ?? null,
        Object.prototype.hasOwnProperty.call(body, "avatarUrl") ? 1 : 0,
        body.avatarUrl ?? null,
        Object.prototype.hasOwnProperty.call(body, "locale") ? 1 : 0,
        body.locale ?? null,
        now,
        customer.id,
      )
      .run();

    return c.json({
      success: true,
      data: {
        customer: toCustomerSummary(await requireCustomer(c.env, customer.id)),
      },
    });
  },
);

routes.delete("/me", canonicalCustomerAuthMiddleware, async (c) => {
  const now = Date.now();
  await c.env.DB.prepare(
    `UPDATE customers
        SET status = 'deleted', deleted_at_ms = ?, updated_at_ms = ?
      WHERE id = ?`,
  )
    .bind(now, now, c.get("customer").id)
    .run();
  return c.json({ success: true, data: { deleted: true } });
});

routes.get("/preferences", canonicalCustomerAuthMiddleware, async (c) => {
  return c.json({
    success: true,
    data: await loadPreferences(c.env, c.get("customer").id),
  });
});

routes.patch(
  "/preferences",
  canonicalCustomerAuthMiddleware,
  validateBody(preferencesPatchSchema),
  async (c) => {
    const customerId = c.get("customer").id;
    const body = c.get("validatedBody");
    const existing = await loadPreferences(c.env, customerId);
    const merged = { ...existing, ...body };
    const now = Date.now();

    await c.env.DB.prepare(
      `INSERT INTO customer_preferences
        (customer_id, dietary_tags, allergens, default_party_size,
         marketing_opt_in, waiting_list_opt_in, promo_from_favorites_opt_in,
         quiet_hours_start, quiet_hours_end, updated_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(customer_id) DO UPDATE SET
         dietary_tags = excluded.dietary_tags,
         allergens = excluded.allergens,
         default_party_size = excluded.default_party_size,
         marketing_opt_in = excluded.marketing_opt_in,
         waiting_list_opt_in = excluded.waiting_list_opt_in,
         promo_from_favorites_opt_in = excluded.promo_from_favorites_opt_in,
         quiet_hours_start = excluded.quiet_hours_start,
         quiet_hours_end = excluded.quiet_hours_end,
         updated_at_ms = excluded.updated_at_ms`,
    )
      .bind(
        customerId,
        JSON.stringify(merged.dietaryTags ?? []),
        JSON.stringify(merged.allergens ?? []),
        merged.defaultPartySize ?? null,
        merged.marketingOptIn ? 1 : 0,
        merged.waitingListOptIn === false ? 0 : 1,
        merged.promoFromFavoritesOptIn ? 1 : 0,
        merged.quietHoursStart ?? null,
        merged.quietHoursEnd ?? null,
        now,
      )
      .run();

    return c.json({
      success: true,
      data: await loadPreferences(c.env, customerId),
    });
  },
);

routes.get(
  "/push-subscriptions",
  canonicalCustomerAuthMiddleware,
  async (c) => {
    const result = await c.env.DB.prepare(
      `SELECT id, endpoint, p256dh_key, auth_key, user_agent, device_label,
            last_used_at_ms, failure_count, created_at_ms
       FROM customer_push_subscriptions
      WHERE customer_id = ?
      ORDER BY created_at_ms DESC`,
    )
      .bind(c.get("customer").id)
      .all();

    return c.json({ success: true, data: result.results ?? [] });
  },
);

routes.post(
  "/push-subscriptions",
  canonicalCustomerAuthMiddleware,
  validateBody(pushSubscriptionSchema),
  async (c) => {
    const customerId = c.get("customer").id;
    const body = c.get("validatedBody");
    const now = Date.now();
    const id = generateUUID();

    await c.env.DB.prepare(
      `INSERT INTO customer_push_subscriptions
        (id, customer_id, endpoint, p256dh_key, auth_key, user_agent,
         device_label, last_used_at_ms, failure_count, created_at_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         customer_id = excluded.customer_id,
         p256dh_key = excluded.p256dh_key,
         auth_key = excluded.auth_key,
         user_agent = excluded.user_agent,
         device_label = excluded.device_label,
         last_used_at_ms = excluded.last_used_at_ms`,
    )
      .bind(
        id,
        customerId,
        body.endpoint,
        body.p256dh,
        body.auth,
        body.userAgent ?? c.req.header("User-Agent") ?? null,
        body.deviceLabel ?? null,
        now,
        now,
      )
      .run();

    const row = await c.env.DB.prepare(
      `SELECT id, endpoint, device_label, created_at_ms
         FROM customer_push_subscriptions
        WHERE endpoint = ?
        LIMIT 1`,
    )
      .bind(body.endpoint)
      .first();

    return c.json({ success: true, data: row }, 201);
  },
);

routes.delete(
  "/push-subscriptions/:id",
  canonicalCustomerAuthMiddleware,
  async (c) => {
    await c.env.DB.prepare(
      `DELETE FROM customer_push_subscriptions
        WHERE id = ? AND customer_id = ?`,
    )
      .bind(c.req.param("id"), c.get("customer").id)
      .run();
    return c.json({ success: true, data: { deleted: true } });
  },
);

routes.get("/consents", canonicalCustomerAuthMiddleware, async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT id, consent_type, version, granted, granted_at_ms, source
       FROM customer_consents
      WHERE customer_id = ?
        AND granted = 1
        AND revoked_at_ms IS NULL
      ORDER BY granted_at_ms DESC`,
  )
    .bind(c.get("customer").id)
    .all();
  return c.json({ success: true, data: result.results ?? [] });
});

routes.post(
  "/consents",
  canonicalCustomerAuthMiddleware,
  validateBody(consentSchema),
  async (c) => {
    const customerId = c.get("customer").id;
    const body = c.get("validatedBody");
    const now = Date.now();

    if (!body.granted) {
      await c.env.DB.prepare(
        `UPDATE customer_consents
            SET revoked_at_ms = ?
          WHERE customer_id = ?
            AND consent_type = ?
            AND granted = 1
            AND revoked_at_ms IS NULL`,
      )
        .bind(now, customerId, body.consentType)
        .run();
    }

    const duplicate = await c.env.DB.prepare(
      `SELECT id
         FROM customer_consents
        WHERE customer_id = ?
          AND consent_type = ?
          AND version = ?
          AND granted = ?
        ORDER BY granted_at_ms DESC
        LIMIT 1`,
    )
      .bind(customerId, body.consentType, body.version, body.granted ? 1 : 0)
      .first<{ id: string }>();

    if (duplicate) {
      return c.json({ success: true, data: { id: duplicate.id } });
    }

    const id = generateUUID();
    await c.env.DB.prepare(
      `INSERT INTO customer_consents
        (id, customer_id, consent_type, version, granted, granted_at_ms,
         ip_address, user_agent, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        customerId,
        body.consentType,
        body.version,
        body.granted ? 1 : 0,
        now,
        clientIp(c),
        c.req.header("User-Agent") ?? null,
        body.source,
      )
      .run();

    return c.json({ success: true, data: { id } }, 201);
  },
);

async function enforceOtpRateLimit(
  env: Env,
  phone: string,
  ip: string | undefined,
): Promise<void> {
  const phoneKey = `customer_otp_phone:${phone}`;
  const ipKey = `customer_otp_ip:${ip ?? "unknown"}`;
  const phoneCount = Number((await env.RATE_LIMIT_KV.get(phoneKey)) ?? "0");
  const ipCount = Number((await env.RATE_LIMIT_KV.get(ipKey)) ?? "0");

  if (phoneCount >= 3 || ipCount >= 10) {
    throw badRequest("Too many OTP requests", "OTP_RATE_LIMITED");
  }

  await Promise.all([
    env.RATE_LIMIT_KV.put(phoneKey, String(phoneCount + 1), {
      expirationTtl: 60 * 60,
    }),
    env.RATE_LIMIT_KV.put(ipKey, String(ipCount + 1), {
      expirationTtl: 60 * 60,
    }),
  ]);
}

async function findOrCreateCustomerByPhone(
  env: Env,
  phone: string,
  now: number,
): Promise<CustomerRow> {
  const existing = await env.DB.prepare(
    `SELECT * FROM customers
      WHERE primary_phone = ? AND status = 'active'
      LIMIT 1`,
  )
    .bind(phone)
    .first<CustomerRow>();

  if (existing) return existing;

  const id = generateUUID();
  await env.DB.prepare(
    `INSERT INTO customers
      (id, display_name, primary_phone, status, created_at_ms, updated_at_ms)
     VALUES (?, ?, ?, 'active', ?, ?)`,
  )
    .bind(id, phone, phone, now, now)
    .run();

  return requireCustomer(env, id);
}

async function loadCustomer(
  env: Env,
  customerId: string,
): Promise<CustomerRow | null> {
  return env.DB.prepare(
    `SELECT * FROM customers
      WHERE id = ? AND status = 'active'
      LIMIT 1`,
  )
    .bind(customerId)
    .first<CustomerRow>();
}

async function requireCustomer(env: Env, customerId: string) {
  const customer = await loadCustomer(env, customerId);
  if (!customer) {
    throw unauthorized("Customer not found or inactive", "CUSTOMER_INACTIVE");
  }
  return customer;
}

async function loadPreferences(env: Env, customerId: string) {
  const row = await env.DB.prepare(
    `SELECT dietary_tags, allergens, default_party_size, marketing_opt_in,
            waiting_list_opt_in, promo_from_favorites_opt_in,
            quiet_hours_start, quiet_hours_end, updated_at_ms
       FROM customer_preferences
      WHERE customer_id = ?
      LIMIT 1`,
  )
    .bind(customerId)
    .first<Record<string, unknown>>();

  return {
    dietaryTags: parseJsonArray(row?.dietary_tags),
    allergens: parseJsonArray(row?.allergens),
    defaultPartySize: row?.default_party_size ?? null,
    marketingOptIn: Number(row?.marketing_opt_in ?? 0) === 1,
    waitingListOptIn: Number(row?.waiting_list_opt_in ?? 1) === 1,
    promoFromFavoritesOptIn:
      Number(row?.promo_from_favorites_opt_in ?? 0) === 1,
    quietHoursStart: row?.quiet_hours_start ?? null,
    quietHoursEnd: row?.quiet_hours_end ?? null,
    updatedAtMs: row?.updated_at_ms ?? null,
  };
}

async function issueCustomerTokens(env: Env, customerId: string) {
  const now = Math.floor(Date.now() / 1000);
  const refreshId = crypto.randomUUID();
  const accessToken = await sign(
    {
      sub: customerId,
      type: "customer",
      iat: now,
      exp: now + ACCESS_TOKEN_SECONDS,
    },
    env.JWT_SECRET,
  );
  const refreshToken = await sign(
    {
      sub: customerId,
      type: "customer_refresh",
      jti: refreshId,
      iat: now,
      exp: now + REFRESH_TOKEN_SECONDS,
    },
    env.JWT_SECRET,
  );

  await env.TOKEN_BLACKLIST.put(`customer_refresh:${refreshId}`, customerId, {
    expirationTtl: REFRESH_TOKEN_SECONDS,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_SECONDS,
  };
}

function isRefreshPayload(
  decoded: unknown,
): decoded is { sub: string; type: "customer_refresh"; jti: string } {
  if (!decoded || typeof decoded !== "object") return false;
  const payload = decoded as Record<string, unknown>;
  return (
    typeof payload.sub === "string" &&
    payload.type === "customer_refresh" &&
    typeof payload.jti === "string"
  );
}

function toCustomerSummary(customer: CustomerRow) {
  return {
    id: customer.id,
    displayName: customer.display_name,
    primaryPhone: customer.primary_phone,
    primaryEmail: customer.primary_email,
    avatarUrl: customer.avatar_url,
    locale: customer.locale,
    status: customer.status,
    lastSeenAtMs: customer.last_seen_at_ms,
    createdAtMs: customer.created_at_ms,
    updatedAtMs: customer.updated_at_ms,
  };
}

function normalizePhone(value: string): string {
  const compact = value.replace(/[\s\-()]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  return `+${compact}`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x60;/g, "`")
    .replace(/&#x3D;/g, "=");
}

function generateOtp(): string {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return value.toString().padStart(6, "0");
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((item) => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item) => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function clientIp(c: Context): string {
  return (
    c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? ""
  );
}

export default routes;
