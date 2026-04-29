import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../../types/env";
import { authMiddleware } from "../../../middleware/auth";
import { validateBody } from "../../../middleware/validation";

const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm in 24-hour time");

const notificationSettingsSchema = z
  .object({
    newOrders: z.boolean(),
    systemAlerts: z.boolean(),
    backupStatus: z.boolean(),
    performanceAlerts: z.boolean(),
    userActivity: z.boolean(),
    inventoryAlerts: z.boolean(),
    revenueUpdates: z.boolean(),
    sound: z.boolean(),
    vibration: z.boolean(),
    quietHours: z.object({
      enabled: z.boolean(),
      start: timeOfDaySchema,
      end: timeOfDaySchema,
    }),
  })
  .passthrough();

type NotificationSettings = z.infer<typeof notificationSettingsSchema>;

type NotificationSettingsRecord = {
  userId: number;
  restaurantId: string | null;
  settings: NotificationSettings;
  updatedAt: string;
};

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  newOrders: true,
  systemAlerts: true,
  backupStatus: true,
  performanceAlerts: true,
  userActivity: false,
  inventoryAlerts: true,
  revenueUpdates: true,
  sound: true,
  vibration: true,
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
};

const routes = new Hono<{ Bindings: Env }>();

routes.get("/notification-settings", authMiddleware, async (c) => {
  const key = createSettingsKey(c.get("user"));
  const stored = await c.env.CACHE_KV.get<NotificationSettingsRecord>(
    key,
    "json",
  );

  return c.json({
    success: true,
    data: stored?.settings ?? DEFAULT_NOTIFICATION_SETTINGS,
  });
});

routes.put(
  "/notification-settings",
  authMiddleware,
  validateBody(notificationSettingsSchema),
  async (c) => {
    const user = c.get("user");
    const settings = c.get("validatedBody");
    const now = new Date().toISOString();
    const record: NotificationSettingsRecord = {
      userId: user.id,
      restaurantId:
        user.restaurantId !== undefined ? String(user.restaurantId) : null,
      settings,
      updatedAt: now,
    };

    await c.env.CACHE_KV.put(createSettingsKey(user), JSON.stringify(record));

    return c.json({
      success: true,
      data: {
        settings,
        updatedAt: now,
      },
    });
  },
);

function createSettingsKey(user: {
  id: number;
  restaurantId?: string | number;
}): string {
  const restaurantId =
    user.restaurantId !== undefined ? String(user.restaurantId).trim() : "";
  const scope = restaurantId ? encodeURIComponent(restaurantId) : "global";
  return `admin:notification-settings:${scope}:${user.id}`;
}

export default routes;
