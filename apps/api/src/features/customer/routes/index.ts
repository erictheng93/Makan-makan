import { Hono } from "hono";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generateUUID, normalizeE164Phone } from "@makanmakan/utils";
import {
  CUSTOMER_CONSENT_TYPES,
  isCustomerConsentVersion,
} from "@makanmakan/shared-types";
import type { Env } from "../../../types/env";
import {
  canonicalCustomerAuthMiddleware,
  verifyJwtToken,
} from "../../../middleware/auth";
import { validateBody, validateQuery } from "../../../middleware/validation";
import { badRequest, unauthorized } from "../../../shared/utils/api-error";

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
const CUSTOMER_REFRESH_COOKIE = "__Host-mm_customer_refresh";
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const OTP_CODE_SPACE = 1_000_000;
const OTP_RANDOM_BOUNDARY = 4_294_000_000;
type Uint32RandomValues = (values: Uint32Array) => Uint32Array;

const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .transform(normalizeE164Phone)
  .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/));

const requestOtpSchema = z.object({
  phone: phoneSchema,
});

const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().regex(/^\d{6}$/),
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

const favoriteTargetTypeSchema = z.enum(["market", "restaurant", "dish"]);

const favoriteQuerySchema = z.object({
  targetType: favoriteTargetTypeSchema.optional(),
});

const favoriteSchema = z.object({
  targetType: favoriteTargetTypeSchema,
  targetId: z.string().trim().min(1).max(128),
});

const recentMarketsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

const recentMarketSchema = z.object({
  marketId: z.string().trim().min(1).max(128),
  visitedAtMs: z.number().int().positive().optional(),
});

function setCustomerRefreshCookie<E extends { Bindings: Env }>(
  c: Context<E>,
  refreshToken: string,
) {
  setCookie(c, CUSTOMER_REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: REFRESH_TOKEN_SECONDS,
  });
}

function clearCustomerRefreshCookie<E extends { Bindings: Env }>(
  c: Context<E>,
) {
  deleteCookie(c, CUSTOMER_REFRESH_COOKIE, {
    secure: true,
    sameSite: "Lax",
    path: "/",
  });
}

const consentSchema = z
  .object({
    consentType: z.enum(CUSTOMER_CONSENT_TYPES),
    version: z.string().trim().min(1).max(100),
    granted: z.boolean(),
    source: z
      .enum(["onboarding", "settings", "inline_prompt"])
      .default("settings"),
  })
  .superRefine((value, ctx) => {
    if (!isCustomerConsentVersion(value.consentType, value.version)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["version"],
        message: "Unsupported customer consent version",
      });
    }
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
  setCustomerRefreshCookie(c, tokens.refreshToken);

  return c.json({
    success: true,
    data: {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      customer: toCustomerSummary(customer),
    },
  });
});

routes.post("/auth/refresh", async (c) => {
  const body = await readOptionalJson(c);
  const refreshToken =
    typeof body?.refreshToken === "string"
      ? body.refreshToken
      : getCookie(c, CUSTOMER_REFRESH_COOKIE);

  if (!refreshToken) {
    throw unauthorized("Refresh token is required", "TOKEN_INVALID");
  }

  const decoded = verifyJwtToken(refreshToken, c.env.JWT_SECRET);
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
  setCustomerRefreshCookie(c, tokens.refreshToken);

  return c.json({
    success: true,
    data: {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
    },
  });
});

routes.post("/auth/logout", canonicalCustomerAuthMiddleware, async (c) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7)
    : undefined;
  const body = await readOptionalJson(c);
  const refreshToken =
    typeof body?.refreshToken === "string"
      ? body.refreshToken
      : getCookie(c, CUSTOMER_REFRESH_COOKIE);

  if (token) {
    await c.env.TOKEN_BLACKLIST.put(`token:${token}`, "blacklisted", {
      expirationTtl: ACCESS_TOKEN_SECONDS,
    });
  }

  if (refreshToken) {
    await revokeCustomerRefreshToken(c.env, refreshToken);
  }

  clearCustomerRefreshCookie(c);

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
  "/favorites",
  canonicalCustomerAuthMiddleware,
  validateQuery(favoriteQuerySchema),
  async (c) => {
    const customerId = c.get("customer").id;
    const { targetType } = c.get("validatedQuery");
    const result = targetType
      ? await c.env.DB.prepare(
          `SELECT id, target_type, target_id, created_at_ms
             FROM customer_favorites
            WHERE customer_id = ? AND target_type = ?
            ORDER BY created_at_ms DESC`,
        )
          .bind(customerId, targetType)
          .all()
      : await c.env.DB.prepare(
          `SELECT id, target_type, target_id, created_at_ms
             FROM customer_favorites
            WHERE customer_id = ?
            ORDER BY created_at_ms DESC`,
        )
          .bind(customerId)
          .all();

    return c.json({
      success: true,
      data: (result.results ?? []).map(toFavoriteSummary),
    });
  },
);

routes.post(
  "/favorites",
  canonicalCustomerAuthMiddleware,
  validateBody(favoriteSchema),
  async (c) => {
    const customerId = c.get("customer").id;
    const body = c.get("validatedBody");
    const now = Date.now();

    await validateFavoriteTarget(c.env, body.targetType, body.targetId);

    const existing = await c.env.DB.prepare(
      `SELECT id, target_type, target_id, created_at_ms
         FROM customer_favorites
        WHERE customer_id = ? AND target_type = ? AND target_id = ?
        LIMIT 1`,
    )
      .bind(customerId, body.targetType, body.targetId)
      .first();

    if (existing) {
      return c.json({ success: true, data: toFavoriteSummary(existing) });
    }

    await c.env.DB.prepare(
      `INSERT INTO customer_favorites
        (customer_id, target_type, target_id, created_at_ms)
       VALUES (?, ?, ?, ?)`,
    )
      .bind(customerId, body.targetType, body.targetId, now)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT id, target_type, target_id, created_at_ms
         FROM customer_favorites
        WHERE customer_id = ? AND target_type = ? AND target_id = ?
        LIMIT 1`,
    )
      .bind(customerId, body.targetType, body.targetId)
      .first();

    return c.json({ success: true, data: toFavoriteSummary(row) }, 201);
  },
);

routes.delete("/favorites/:id", canonicalCustomerAuthMiddleware, async (c) => {
  await c.env.DB.prepare(
    `DELETE FROM customer_favorites
        WHERE id = ? AND customer_id = ?`,
  )
    .bind(c.req.param("id"), c.get("customer").id)
    .run();
  return c.json({ success: true, data: { deleted: true } });
});

routes.get(
  "/recent-markets",
  canonicalCustomerAuthMiddleware,
  validateQuery(recentMarketsQuerySchema),
  async (c) => {
    const customerId = c.get("customer").id;
    const { limit } = c.get("validatedQuery");
    const result = await c.env.DB.prepare(
      `SELECT market_id, visited_at_ms
         FROM customer_recent_markets
        WHERE customer_id = ?
        ORDER BY visited_at_ms DESC
        LIMIT ?`,
    )
      .bind(customerId, limit)
      .all();

    return c.json({
      success: true,
      data: (result.results ?? []).map(toRecentMarketSummary),
    });
  },
);

routes.post(
  "/recent-markets",
  canonicalCustomerAuthMiddleware,
  validateBody(recentMarketSchema),
  async (c) => {
    const customerId = c.get("customer").id;
    const body = c.get("validatedBody");
    const visitedAtMs = body.visitedAtMs ?? Date.now();

    await validateMarketTarget(c.env, body.marketId);

    await c.env.DB.prepare(
      `INSERT INTO customer_recent_markets
        (customer_id, market_id, visited_at_ms)
       VALUES (?, ?, ?)
       ON CONFLICT(customer_id, market_id) DO UPDATE SET
         visited_at_ms = excluded.visited_at_ms`,
    )
      .bind(customerId, body.marketId, visitedAtMs)
      .run();

    const row = await c.env.DB.prepare(
      `SELECT market_id, visited_at_ms
         FROM customer_recent_markets
        WHERE customer_id = ? AND market_id = ?
        LIMIT 1`,
    )
      .bind(customerId, body.marketId)
      .first();

    return c.json({ success: true, data: toRecentMarketSummary(row) }, 201);
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

async function readOptionalJson(
  c: Context,
): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await c.req.json();
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function revokeCustomerRefreshToken(
  env: Env,
  refreshToken: string,
): Promise<void> {
  try {
    const decoded = verifyJwtToken(refreshToken, env.JWT_SECRET);
    if (isRefreshPayload(decoded)) {
      await env.TOKEN_BLACKLIST.delete(`customer_refresh:${decoded.jti}`);
    }
  } catch {
    // Logout is best-effort: an invalid refresh token should not prevent
    // the access token from being invalidated.
  }
}

async function validateFavoriteTarget(
  env: Env,
  targetType: z.infer<typeof favoriteTargetTypeSchema>,
  targetId: string,
): Promise<void> {
  if (targetType === "restaurant") {
    const row = await env.DB.prepare(
      `SELECT id
         FROM restaurants
        WHERE id = ? AND deleted_at_ms IS NULL
        LIMIT 1`,
    )
      .bind(targetId)
      .first();
    if (!row) throw badRequest("Favorite target not found", "TARGET_NOT_FOUND");
    return;
  }

  if (targetType === "dish") {
    const numericTargetId = Number(targetId);
    if (!Number.isInteger(numericTargetId) || numericTargetId <= 0) {
      throw badRequest("Favorite target not found", "TARGET_NOT_FOUND");
    }
    const row = await env.DB.prepare(
      `SELECT id
         FROM menu_items
        WHERE id = ? AND deleted_at_ms IS NULL
        LIMIT 1`,
    )
      .bind(numericTargetId)
      .first();
    if (!row) throw badRequest("Favorite target not found", "TARGET_NOT_FOUND");
    return;
  }

  await validateMarketTarget(env, targetId);
}

async function validateMarketTarget(env: Env, marketId: string): Promise<void> {
  const marketsTable = await env.DB.prepare(
    `SELECT name
       FROM sqlite_master
      WHERE type = 'table' AND name = 'markets'
      LIMIT 1`,
  ).first();
  if (!marketsTable) {
    throw badRequest(
      "Market favorites are not available yet",
      "TARGET_NOT_FOUND",
    );
  }

  const row = await env.DB.prepare(
    `SELECT id
       FROM markets
      WHERE id = ? AND deleted_at_ms IS NULL
      LIMIT 1`,
  )
    .bind(marketId)
    .first();
  if (!row) throw badRequest("Market not found", "TARGET_NOT_FOUND");
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

  await env.DB.prepare(
    `UPDATE customers
        SET primary_phone = NULL,
            updated_at_ms = ?
      WHERE primary_phone = ?
        AND status = 'deleted'`,
  )
    .bind(now, phone)
    .run();

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

export async function pruneStaleCustomerPushSubscriptions(
  env: Env,
  nowMs = Date.now(),
): Promise<{ deleted: number }> {
  const staleBeforeMs = nowMs - 90 * 24 * 60 * 60 * 1000;
  const result = await env.DB.prepare(
    `DELETE FROM customer_push_subscriptions
      WHERE last_used_at_ms < ?
        AND failure_count >= 3`,
  )
    .bind(staleBeforeMs)
    .run();

  return { deleted: result.meta.changes ?? 0 };
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

function toFavoriteSummary(row: unknown) {
  const favorite = row as {
    id: number;
    target_type: string;
    target_id: string;
    created_at_ms: number;
  } | null;

  if (!favorite) return null;

  return {
    id: favorite.id,
    targetType: favorite.target_type,
    targetId: favorite.target_id,
    createdAtMs: favorite.created_at_ms,
  };
}

function toRecentMarketSummary(row: unknown) {
  const recentMarket = row as {
    market_id: string;
    visited_at_ms: number;
  } | null;

  if (!recentMarket) return null;

  return {
    marketId: recentMarket.market_id,
    visitedAtMs: recentMarket.visited_at_ms,
  };
}

function decodeHtmlEntities(value: string): string {
  // Decode &amp; LAST so a literal `&amp;lt;` round-trips to `&lt;`, not `<`
  // (decoding it first would re-expose escaped markup — a sanitizer bypass).
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x60;/g, "`")
    .replace(/&#x3D;/g, "=")
    .replace(/&amp;/g, "&");
}

export function generateOtp(
  getRandomValues: Uint32RandomValues = (values) =>
    crypto.getRandomValues(values),
): string {
  const values = new Uint32Array(1);

  while (true) {
    getRandomValues(values);
    const value = values[0];

    if (value >= OTP_RANDOM_BOUNDARY) {
      continue;
    }

    return (value % OTP_CODE_SPACE).toString().padStart(6, "0");
  }
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
