/**
 * Waiting List Routes
 * API routes for waiting list/queue management system
 */

import { Hono } from "hono";
import {
  authMiddleware,
  optionalCanonicalCustomerAuthMiddleware,
  requireRole,
} from "../../../middleware/auth";
import { moduleGate } from "../../../middleware/moduleGate";
import { WaitingListService } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import {
  WaitingStatus,
  type JoinWaitingListRequest,
  type WaitingListFilters,
  type CallWaitingRequest,
} from "@makanmakan/shared-types";
import {
  notFound,
  forbidden,
  badRequest,
} from "../../../shared/utils/api-error";
import { strictRateLimit } from "../../../middleware/rateLimit";

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

/** Fetch entry and verify the user has access to its restaurant. */
async function requireEntryAccess(
  service: WaitingListService,
  id: string,
  user: AuthUser,
) {
  const entry = await service.getWaitingListEntryById(id);
  if (!entry) throw notFound("找不到此候位記錄");
  if (user.role !== 0 && entry.restaurantId !== user.restaurantId!.toString()) {
    throw forbidden("無權限操作此候位");
  }
  return entry;
}

async function waitUntilBackgroundTasks(
  c: { executionCtx?: { waitUntil?(promise: Promise<unknown>): void } },
  service: WaitingListService,
): Promise<void> {
  const tasks = service.drainBackgroundTasks();
  if (tasks.length === 0) return;
  const drained = Promise.allSettled(tasks).then(() => undefined);
  if (c.executionCtx?.waitUntil) {
    c.executionCtx.waitUntil(drained);
    return;
  }
  await drained;
}

/**
 * POST /waiting-list
 * 加入候位列表
 */
app.post("/", optionalCanonicalCustomerAuthMiddleware, async (c) => {
  const body = await c.req.json<JoinWaitingListRequest>();
  const customer = c.get("customer");
  const service = new WaitingListService(c.env.DB, c.env);

  // 驗證必填欄位
  if (
    !body.restaurantId ||
    !body.customerName ||
    !body.customerPhone ||
    !body.partySize
  ) {
    throw badRequest("缺少必填欄位");
  }

  const entry = await service.joinWaitingList({
    ...body,
    customerId: customer?.id,
  });
  await waitUntilBackgroundTasks(c, service);

  return c.json(
    {
      success: true,
      data: entry,
      message: `已加入候位，號碼 ${entry.queueDisplay}`,
    },
    201,
  );
});

/**
 * GET /waiting-list/lookup?restaurantId=&phone=
 * G3: 顧客遺失 ticketId 後依手機找回當日 active 票（公開）。
 *     僅回 status in (waiting | called | confirmed) 的票；終態票一律
 *     視為「無 active 票」回 404，避免洩漏歷史。
 *
 * IMPORTANT: must be registered BEFORE GET /:id, otherwise Hono routes
 * `/lookup` to the parametric handler with id="lookup".
 */
app.get("/lookup", async (c) => {
  const restaurantId = c.req.query("restaurantId");
  const phoneRaw = c.req.query("phone");

  if (!restaurantId) {
    throw badRequest("缺少 restaurantId 參數", "MISSING_RESTAURANT_ID");
  }
  if (!phoneRaw) {
    throw badRequest("缺少 phone 參數", "MISSING_PHONE");
  }

  // 與 service 層 validateWaitingListData 一致的台灣手機格式
  const phone = phoneRaw.replace(/[-\s]/g, "");
  if (!/^09\d{8}$/.test(phone)) {
    throw badRequest("電話格式錯誤", "INVALID_PHONE_FORMAT");
  }

  const service = new WaitingListService(c.env.DB, c.env);
  const entry = await service.findActiveTicketByPhone(restaurantId, phone);

  if (!entry) {
    throw notFound("當日無 active 候位記錄", "NO_ACTIVE_TICKET");
  }

  return c.json({
    success: true,
    data: entry,
  });
});

/**
 * GET /waiting-list/history?restaurantId=&phone=&limit=
 * 顧客依手機查詢候位歷史。公開端點必須限流，避免手機號碼枚舉。
 */
app.get("/history", strictRateLimit, async (c) => {
  const restaurantId = c.req.query("restaurantId");
  const phoneRaw = c.req.query("phone");
  const limit = Number.parseInt(c.req.query("limit") || "20", 10);

  if (!restaurantId) {
    throw badRequest("缺少 restaurantId 參數", "MISSING_RESTAURANT_ID");
  }
  if (!phoneRaw) {
    throw badRequest("缺少 phone 參數", "MISSING_PHONE");
  }

  const phone = phoneRaw.replace(/[-\s]/g, "");
  if (!/^09\d{8}$/.test(phone)) {
    throw badRequest("電話格式錯誤", "INVALID_PHONE_FORMAT");
  }

  const service = new WaitingListService(c.env.DB, c.env);
  const history = await service.listWaitingListHistoryByPhone(
    restaurantId,
    phone,
    Number.isFinite(limit) ? limit : 20,
  );

  return c.json({
    success: true,
    data: history,
  });
});

/**
 * GET /waiting-list/:id
 * 查詢候位記錄詳情
 */
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const service = new WaitingListService(c.env.DB, c.env);

  const entry = await service.getWaitingListEntryById(id);

  if (!entry) {
    throw notFound("找不到此候位記錄");
  }

  return c.json({
    success: true,
    data: entry,
  });
});

/**
 * GET /waiting-list/queue-status/:restaurantId
 * 查詢餐廳候位狀態
 */
app.get("/queue-status/:restaurantId", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const service = new WaitingListService(c.env.DB, c.env);

  const status = await service.getQueueStatus(restaurantId);

  return c.json({
    success: true,
    data: status,
  });
});

/**
 * GET /waiting-list/estimate-wait/:restaurantId
 * 估算等待時間（公開）
 */
app.get("/estimate-wait/:restaurantId", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const partySize = parseInt(c.req.query("partySize") || "2");
  const service = new WaitingListService(c.env.DB, c.env);

  const estimate = await service.estimateWaitTime({
    restaurantId,
    partySize,
  });

  return c.json({
    success: true,
    data: estimate,
  });
});

/**
 * DELETE /waiting-list/:id
 * 取消候位（公開，使用電話驗證）
 */
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const { customerPhone } = await c.req.json();

  if (!customerPhone) {
    throw badRequest("需要提供電話號碼");
  }

  const service = new WaitingListService(c.env.DB, c.env);

  // 驗證電話號碼
  const entry = await service.getWaitingListEntryById(id);
  if (!entry || entry.customerPhone !== customerPhone) {
    throw forbidden("電話號碼不符");
  }

  const cancelled = await service.cancelWaiting(id);
  await waitUntilBackgroundTasks(c, service);

  return c.json({
    success: true,
    data: cancelled,
    message: "候位已取消",
  });
});

/**
 * POST /waiting-list/:id/confirm
 * G5: 顧客確認候位（公開）—— 必須帶 customerPhone 做主驗證，
 *     防止任何拿到 ticketId 的人替顧客「代為確認」。比對策略與
 *     DELETE /:id 取消端點一致：直接 string equality，不做 phone
 *     normalize（避免引入新歧義）。
 */
app.post("/:id/confirm", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");

  const { customerPhone } = await c.req.json<{ customerPhone?: string }>();
  if (!customerPhone) {
    throw badRequest("需要提供電話號碼", "MISSING_PHONE");
  }

  const service = new WaitingListService(c.env.DB, c.env);

  const entry = await service.getWaitingListEntryById(id);
  if (!entry) {
    throw notFound("找不到此候位記錄", "ENTRY_NOT_FOUND");
  }
  if (entry.customerPhone !== customerPhone) {
    throw forbidden("電話號碼不符", "PHONE_MISMATCH");
  }

  const confirmed = await service.confirmWaiting(id);
  await waitUntilBackgroundTasks(c, service);

  return c.json({
    success: true,
    data: confirmed,
    message: "已確認，請盡快入座",
  });
});

app.use("/*", authMiddleware);
app.use("/*", moduleGate("reservations"));

/**
 * GET /waiting-list
 * 查詢候位列表
 */
app.get("/", requireRole([0, 1, 3, 4]), async (c) => {
  const user = c.get("user");
  const service = new WaitingListService(c.env.DB, c.env);

  // 建構過濾條件
  const filters: WaitingListFilters = {
    restaurantId:
      user.role === 0
        ? c.req.query("restaurantId")
        : user.restaurantId!.toString(),
    status: c.req.query("status") as WaitingStatus,
    customerPhone: c.req.query("phone"),
    date: c.req.query("date"),
    page: parseInt(c.req.query("page") || "1"),
    limit: parseInt(c.req.query("limit") || "50"),
  };

  const result = await service.listWaitingList(filters);

  return c.json({
    success: true,
    data: result.data,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / (filters.limit || 50)),
    },
  });
});

/**
 * POST /waiting-list/:id/call
 * 叫號
 */
app.post("/:id/call", requireRole([0, 1, 3, 4]), async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const body = await c.req.json<CallWaitingRequest>();
  const service = new WaitingListService(c.env.DB, c.env);

  if (!body.tableId) {
    throw badRequest("需要指定桌位");
  }

  const user = c.get("user");
  await requireEntryAccess(service, id, user);

  const called = await service.callWaiting(id, body);
  await waitUntilBackgroundTasks(c, service);

  return c.json({
    success: true,
    data: called,
    message: "已叫號，通知已發送",
  });
});

/**
 * POST /waiting-list/:id/seat
 * 標記入座
 */
app.post("/:id/seat", requireRole([0, 1, 3, 4]), async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const service = new WaitingListService(c.env.DB, c.env);
  const user = c.get("user");
  await requireEntryAccess(service, id, user);

  const seated = await service.markSeated(id);
  await waitUntilBackgroundTasks(c, service);

  return c.json({
    success: true,
    data: seated,
    message: "已登記入座",
  });
});

/**
 * POST /waiting-list/:id/expire
 * 標記過期
 */
app.post("/:id/expire", requireRole([0, 1, 3, 4]), async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const service = new WaitingListService(c.env.DB, c.env);
  const user = c.get("user");
  await requireEntryAccess(service, id, user);

  const expired = await service.expireWaiting(id);
  await waitUntilBackgroundTasks(c, service);

  return c.json({
    success: true,
    data: expired,
    message: "已登記過期",
  });
});

/**
 * GET /waiting-list/stats/:restaurantId
 * 取得候位統計
 */
app.get("/stats/:restaurantId", requireRole([0, 1]), async (c) => {
  const restaurantId = c.req.param("restaurantId");
  if (!restaurantId)
    throw badRequest("Missing restaurantId parameter", "MISSING_PARAM");
  const date = c.req.query("date"); // YYYY-MM-DD
  const service = new WaitingListService(c.env.DB, c.env);

  // 權限檢查
  const user = c.get("user");
  if (user.role !== 0 && restaurantId !== user.restaurantId!.toString()) {
    throw forbidden("無權限查看此統計");
  }

  const stats = await service.getWaitingStats(restaurantId, date);

  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * POST /waiting-list/batch-call
 * 批次叫號（自動叫下一組）
 */
app.post("/batch-call", requireRole([0, 1, 3, 4]), async (c) => {
  const { restaurantId, count = 1 } = await c.req.json();
  const user = c.get("user");

  // 權限檢查
  const targetRestaurantId = user.role === 0 ? restaurantId : user.restaurantId;
  if (!targetRestaurantId) {
    throw badRequest("需要指定餐廳ID");
  }

  const service = new WaitingListService(c.env.DB, c.env);
  const results = await service.batchCallNext(targetRestaurantId, count);
  await waitUntilBackgroundTasks(c, service);

  return c.json({
    success: true,
    data: results,
    message: `批次叫號完成：${results.filter((r) => r.success).length}/${results.length} 成功`,
  });
});

export default app;
