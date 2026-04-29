import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../types/env";
import { authMiddleware } from "../../../middleware/auth";
import { validateBody } from "../../../middleware/validation";

const SUBSCRIPTION_TTL_SECONDS = 60 * 60 * 24 * 365;

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  keys: z.object({
    p256dh: z.string().min(1).max(2048),
    auth: z.string().min(1).max(2048),
  }),
});

const subscribeSchema = z
  .object({
    subscription: pushSubscriptionSchema,
    user_type: z.string().min(1).max(50).default("admin"),
    role: z.union([z.string(), z.number()]).optional(),
    restaurant_id: z.union([z.string(), z.number()]).optional(),
    device_info: z.record(z.unknown()).default({}),
  })
  .passthrough();

type PushSubscriptionRecord = {
  id: string;
  userId: number;
  username: string;
  userRole: number;
  requestedRole?: string | number;
  userType: string;
  restaurantId: string | null;
  subscription: z.infer<typeof pushSubscriptionSchema>;
  deviceInfo: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

const routes = new Hono<{ Bindings: Env }>();

routes.post(
  "/subscribe",
  authMiddleware,
  validateBody(subscribeSchema),
  async (c) => {
    const body = c.get("validatedBody");
    const user = c.get("user");
    const restaurantId =
      body.restaurant_id !== undefined
        ? String(body.restaurant_id)
        : user.restaurantId !== undefined
          ? String(user.restaurantId)
          : null;
    const subscriptionId = await createSubscriptionId(
      body.subscription.endpoint,
    );
    const now = new Date().toISOString();
    const key = [
      "push",
      "subscription",
      keySegment(restaurantId, "global"),
      String(user.id),
      subscriptionId,
    ].join(":");
    const existing = await c.env.CACHE_KV.get<PushSubscriptionRecord>(
      key,
      "json",
    );

    const record: PushSubscriptionRecord = {
      id: subscriptionId,
      userId: user.id,
      username: user.username,
      userRole: user.role,
      requestedRole: body.role,
      userType: body.user_type,
      restaurantId,
      subscription: body.subscription,
      deviceInfo: body.device_info,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await c.env.CACHE_KV.put(key, JSON.stringify(record), {
      expirationTtl: SUBSCRIPTION_TTL_SECONDS,
    });

    return c.json({
      success: true,
      data: {
        subscriptionId,
        subscribed: true,
        restaurantId,
        updatedAt: now,
      },
    });
  },
);

async function createSubscriptionId(endpoint: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buffer = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(endpoint),
    );
    return Array.from(new Uint8Array(buffer), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  return fallbackHash(endpoint);
}

function fallbackHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function keySegment(
  value: string | null | undefined,
  fallback: string,
): string {
  const rawValue = value?.trim();
  return rawValue ? encodeURIComponent(rawValue) : fallback;
}

export default routes;
