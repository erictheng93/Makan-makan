import type { Context, MiddlewareHandler, Next } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Env } from "../types/env";
import { ApiError } from "../shared/utils/api-error";

interface IdempotencyRecord {
  key: string;
  scope: string;
  request_hash: string;
  response_status: number | null;
  response_body: string | null;
  effect_id: string | null;
  created_at: number;
  expires_at: number;
}

export interface IdempotencyOptions {
  scope: string;
  ttlSeconds?: number;
  requireKey?: boolean;
  keyResolver?: (
    c: Context<{ Bindings: Env }>,
    rawBody: string,
  ) => string | null | Promise<string | null>;
  effectId?: (
    c: Context<{ Bindings: Env }>,
    response: Response,
  ) => string | null | Promise<string | null>;
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function addDuplicateEffectsMarker(body: string | null): string {
  if (!body) {
    return JSON.stringify({ success: true, data: { duplicateEffects: 0 } });
  }

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const data =
      parsed.data &&
      typeof parsed.data === "object" &&
      !Array.isArray(parsed.data)
        ? { ...(parsed.data as Record<string, unknown>), duplicateEffects: 0 }
        : { duplicateEffects: 0 };
    return JSON.stringify({ ...parsed, data });
  } catch {
    return body;
  }
}

async function readExisting(
  c: Context<{ Bindings: Env }>,
  key: string,
): Promise<IdempotencyRecord | null> {
  return await c.env.DB.prepare(
    `SELECT key, scope, request_hash, response_status, response_body, effect_id,
            created_at, expires_at
       FROM idempotency_keys
      WHERE key = ?`,
  )
    .bind(key)
    .first<IdempotencyRecord>();
}

async function deleteExpired(c: Context<{ Bindings: Env }>, key: string) {
  await c.env.DB.prepare("DELETE FROM idempotency_keys WHERE key = ?")
    .bind(key)
    .run();
}

async function reserveKey(
  c: Context<{ Bindings: Env }>,
  key: string,
  scope: string,
  requestHash: string,
  now: number,
  expiresAt: number,
) {
  return await c.env.DB.prepare(
    `INSERT OR IGNORE INTO idempotency_keys
       (key, scope, request_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(key, scope, requestHash, now, expiresAt)
    .run();
}

async function storeResponse(
  c: Context<{ Bindings: Env }>,
  key: string,
  status: number,
  body: string,
  effectId: string | null,
) {
  await c.env.DB.prepare(
    `UPDATE idempotency_keys
        SET response_status = ?, response_body = ?, effect_id = ?
      WHERE key = ?`,
  )
    .bind(status, body, effectId, key)
    .run();
}

function jsonError(message: string, code: string, status: number): ApiError {
  return new ApiError(code, message, status);
}

async function readBodyForIdempotency(
  c: Context<{ Bindings: Env }>,
): Promise<string> {
  try {
    return await c.req.raw.clone().text();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("ReadableStream") && !message.includes("locked")) {
      throw error;
    }

    const parsed = await c.req.json();
    return JSON.stringify(parsed);
  }
}

export function idempotencyMiddleware(
  options: IdempotencyOptions,
): MiddlewareHandler<{ Bindings: Env }> {
  const ttlSeconds = options.ttlSeconds ?? 24 * 60 * 60;
  const requireKey = options.requireKey ?? true;

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const rawBody = await readBodyForIdempotency(c);
    const resolvedKey =
      (await options.keyResolver?.(c, rawBody)) ??
      c.req.header("Idempotency-Key") ??
      null;
    const key = resolvedKey?.trim();

    if (!key) {
      if (!requireKey) {
        await next();
        return;
      }
      throw jsonError(
        "Idempotency-Key header is required",
        "IDEMPOTENCY_KEY_REQUIRED",
        400,
      );
    }

    const requestHash = await sha256Hex(rawBody);
    const now = Date.now();
    const existing = await readExisting(c, key);

    if (existing && existing.expires_at <= now) {
      await deleteExpired(c, key);
    } else if (existing) {
      if (existing.scope !== options.scope) {
        throw jsonError(
          "Idempotency key was already used for a different scope",
          "IDEMPOTENCY_SCOPE_MISMATCH",
          422,
        );
      }

      if (existing.request_hash !== requestHash) {
        throw jsonError(
          "Idempotency key was reused with a different request body",
          "IDEMPOTENCY_BODY_MISMATCH",
          422,
        );
      }

      if (existing.response_status != null) {
        return c.body(addDuplicateEffectsMarker(existing.response_body), {
          status: existing.response_status as ContentfulStatusCode,
          headers: {
            "Content-Type": "application/json",
            "X-Idempotent-Replay": "true",
          },
        });
      }

      throw jsonError(
        "Idempotent request is still being processed",
        "IDEMPOTENCY_IN_PROGRESS",
        409,
      );
    }

    const reservation = await reserveKey(
      c,
      key,
      options.scope,
      requestHash,
      now,
      now + ttlSeconds * 1000,
    );
    if ((reservation as { meta?: { changes?: number } }).meta?.changes === 0) {
      const racedRecord = await readExisting(c, key);
      if (racedRecord && racedRecord.scope !== options.scope) {
        throw jsonError(
          "Idempotency key was already used for a different scope",
          "IDEMPOTENCY_SCOPE_MISMATCH",
          422,
        );
      }
      if (racedRecord && racedRecord.request_hash !== requestHash) {
        throw jsonError(
          "Idempotency key was reused with a different request body",
          "IDEMPOTENCY_BODY_MISMATCH",
          422,
        );
      }
      if (racedRecord?.response_status != null) {
        return c.body(addDuplicateEffectsMarker(racedRecord.response_body), {
          status: racedRecord.response_status as ContentfulStatusCode,
          headers: {
            "Content-Type": "application/json",
            "X-Idempotent-Replay": "true",
          },
        });
      }
      throw jsonError(
        "Idempotent request is still being processed",
        "IDEMPOTENCY_IN_PROGRESS",
        409,
      );
    }

    await next();

    const response = c.res.clone();
    const responseBody = await response.text();
    const effectId = (await options.effectId?.(c, c.res.clone())) ?? null;

    await storeResponse(c, key, c.res.status, responseBody, effectId);
  };
}
