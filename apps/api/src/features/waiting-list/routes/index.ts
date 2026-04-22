/**
 * Waiting List Routes
 * API routes for waiting list/queue management system
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
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

/**
 * POST /waiting-list
 * 加入候位列表
 */
app.post("/", async (c) => {
  const body = await c.req.json<JoinWaitingListRequest>();
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

  const entry = await service.joinWaitingList(body);

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
 * GET /waiting-list/:id
 * 查詢候位記錄詳情
 */
app.get("/:id", async (c) => {
  const id = c.req.param("id");
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

  return c.json({
    success: true,
    data: cancelled,
    message: "候位已取消",
  });
});

/**
 * POST /waiting-list/:id/confirm
 * 顧客確認候位（公開）
 */
app.post("/:id/confirm", async (c) => {
  const id = c.req.param("id");
  const service = new WaitingListService(c.env.DB, c.env);

  const confirmed = await service.confirmWaiting(id);

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
  const body = await c.req.json<CallWaitingRequest>();
  const service = new WaitingListService(c.env.DB, c.env);

  if (!body.tableId) {
    throw badRequest("需要指定桌位");
  }

  const user = c.get("user");
  await requireEntryAccess(service, id, user);

  const called = await service.callWaiting(id, body);

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
  const service = new WaitingListService(c.env.DB, c.env);
  const user = c.get("user");
  await requireEntryAccess(service, id, user);

  const seated = await service.markSeated(id);

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
  const service = new WaitingListService(c.env.DB, c.env);
  const user = c.get("user");
  await requireEntryAccess(service, id, user);

  const expired = await service.expireWaiting(id);

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

  return c.json({
    success: true,
    data: results,
    message: `批次叫號完成：${results.filter((r) => r.success).length}/${results.length} 成功`,
  });
});

export default app;
