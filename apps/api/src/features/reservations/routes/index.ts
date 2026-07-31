/**
 * Reservations Routes
 * API routes for reservation management system
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { moduleGate } from "../../../middleware/moduleGate";
import { ReservationService } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import type { AuthUser } from "../../../middleware/auth";
import {
  ReservationStatus,
  type CreateReservationRequest,
  type UpdateReservationRequest,
  type ReservationFilters,
} from "@makanmakan/shared-types";
import {
  notFound,
  forbidden,
  badRequest,
} from "../../../shared/utils/api-error";

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

async function requireReservationAccess(
  c: { get(key: "user"): AuthUser },
  service: Pick<ReservationService, "getReservationById">,
  id: string,
) {
  const reservation = await service.getReservationById(id);
  if (!reservation) {
    throw notFound("Reservation not found");
  }

  const user = c.get("user");
  if (
    user.role !== 0 &&
    reservation.restaurantId !== String(user.restaurantId)
  ) {
    throw forbidden("Access denied to this reservation");
  }

  return reservation;
}

// ==========================================
// Public Routes - 顧客可使用
// ==========================================

/**
 * POST /reservations
 * 建立新訂位
 */
app.post("/", async (c) => {
  const body = await c.req.json<CreateReservationRequest>();
  const service = new ReservationService(c.env.DB, c.env);

  // 驗證必填欄位
  if (
    !body.restaurantId ||
    !body.customerName ||
    !body.customerPhone ||
    !body.partySize ||
    !body.reservationDate ||
    !body.reservationTime
  ) {
    throw badRequest("缺少必填欄位");
  }

  const reservation = await service.createReservation(body);

  return c.json(
    {
      success: true,
      data: reservation,
      message: "訂位成功！確認碼已發送至您的手機",
    },
    201,
  );
});

/**
 * GET /reservations/verify/:code
 * 驗證確認碼並查詢訂位
 */
app.get("/verify/:code", async (c) => {
  const code = c.req.param("code");
  const service = new ReservationService(c.env.DB, c.env);

  const reservation = await service.getReservationByCode(code);

  if (!reservation) {
    throw notFound("找不到此訂位");
  }

  return c.json({
    success: true,
    data: reservation,
  });
});

/**
 * GET /reservations/availability
 * 查詢可用時段
 */
app.get("/availability", async (c) => {
  const restaurantId = c.req.query("restaurantId");
  const date = c.req.query("date");
  const partySize = c.req.query("partySize");

  if (!restaurantId || !date || !partySize) {
    throw badRequest("缺少必填參數");
  }

  const service = new ReservationService(c.env.DB, c.env);

  const availability = await service.getAvailableSlots({
    restaurantId,
    date,
    partySize: parseInt(partySize),
    duration: parseInt(c.req.query("duration") || "90"),
  });

  return c.json({
    success: true,
    data: availability,
  });
});

/**
 * DELETE /reservations/:id/cancel
 * 取消訂位（公開，使用確認碼驗證）
 */
app.delete("/:id/cancel", async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const { confirmationCode, reason } = await c.req.json();

  if (!confirmationCode) {
    throw badRequest("需要確認碼");
  }

  const service = new ReservationService(c.env.DB, c.env);

  // 驗證確認碼
  const reservation = await service.getReservationById(id);
  if (!reservation || reservation.confirmationCode !== confirmationCode) {
    throw forbidden("確認碼錯誤");
  }

  const cancelled = await service.cancelReservation(id, reason);

  return c.json({
    success: true,
    data: cancelled,
    message: "訂位已取消",
  });
});

// ==========================================
// Protected Routes - 需要認證
// ==========================================

app.use("/*", authMiddleware);
app.use("/*", moduleGate("reservations"));

/**
 * GET /reservations
 * 查詢訂位列表（店員/管理員）
 */
app.get("/", requireRole([0, 1, 4]), async (c) => {
  const user = c.get("user");
  const service = new ReservationService(c.env.DB, c.env);

  // 建構過濾條件
  const filters: ReservationFilters = {
    restaurantId:
      user.role === 0
        ? c.req.query("restaurantId")
        : user.restaurantId!.toString(),
    status: c.req.query("status") as ReservationStatus,
    reservationDate: c.req.query("date"),
    startDate: c.req.query("startDate"),
    endDate: c.req.query("endDate"),
    customerPhone: c.req.query("phone"),
    confirmationCode: c.req.query("code"),
    page: parseInt(c.req.query("page") || "1"),
    limit: parseInt(c.req.query("limit") || "20"),
    sortBy: (c.req.query("sortBy") ||
      "created_at") as ReservationFilters["sortBy"],
    sortOrder: (c.req.query("sortOrder") as "asc" | "desc") || "desc",
  };

  const result = await service.listReservations(filters);

  return c.json({
    success: true,
    data: result.data,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / (filters.limit || 20)),
    },
  });
});

/**
 * GET /reservations/:id
 * 查詢單一訂位詳情
 */
app.get("/:id", requireRole([0, 1, 3, 4]), async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const service = new ReservationService(c.env.DB, c.env);

  const reservation = await service.getReservationById(id);

  if (!reservation) {
    throw notFound("找不到此訂位");
  }

  // 權限檢查：非管理員只能查看自己餐廳的訂位
  const user = c.get("user");
  if (
    user.role !== 0 &&
    reservation.restaurantId !== user.restaurantId!.toString()
  ) {
    throw forbidden("無權限查看此訂位");
  }

  return c.json({
    success: true,
    data: reservation,
  });
});

/**
 * PUT /reservations/:id
 * 更新訂位資訊
 */
app.put("/:id", requireRole([0, 1, 4]), async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const body = await c.req.json<UpdateReservationRequest>();
  const service = new ReservationService(c.env.DB, c.env);

  // 權限檢查
  const existing = await service.getReservationById(id);
  if (!existing) {
    throw notFound("找不到此訂位");
  }

  const user = c.get("user");
  if (
    user.role !== 0 &&
    existing.restaurantId !== user.restaurantId!.toString()
  ) {
    throw forbidden("無權限修改此訂位");
  }

  const updated = await service.updateReservation(id, body);

  return c.json({
    success: true,
    data: updated,
    message: "訂位已更新",
  });
});

/**
 * POST /reservations/:id/confirm
 * 確認訂位
 */
app.post("/:id/confirm", requireRole([0, 1, 4]), async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const service = new ReservationService(c.env.DB, c.env);

  await requireReservationAccess(c, service, id);
  const confirmed = await service.confirmReservation(id);

  return c.json({
    success: true,
    data: confirmed,
    message: "訂位已確認",
  });
});

/**
 * POST /reservations/:id/arrive
 * 標記到店
 */
app.post("/:id/arrive", requireRole([0, 1, 3, 4]), async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const service = new ReservationService(c.env.DB, c.env);

  await requireReservationAccess(c, service, id);
  const arrived = await service.markArrived(id);

  return c.json({
    success: true,
    data: arrived,
    message: "已標記到店",
  });
});

/**
 * POST /reservations/:id/seat
 * 標記入座
 */
app.post("/:id/seat", requireRole([0, 1, 3, 4]), async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const service = new ReservationService(c.env.DB, c.env);

  await requireReservationAccess(c, service, id);
  const seated = await service.markSeated(id);

  return c.json({
    success: true,
    data: seated,
    message: "已標記入座",
  });
});

/**
 * POST /reservations/:id/complete
 * 完成訂位
 */
app.post("/:id/complete", requireRole([0, 1, 3, 4]), async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const service = new ReservationService(c.env.DB, c.env);

  await requireReservationAccess(c, service, id);
  const completed = await service.completeReservation(id);

  return c.json({
    success: true,
    data: completed,
    message: "訂位已完成",
  });
});

/**
 * POST /reservations/:id/no-show
 * 標記未到店
 */
app.post("/:id/no-show", requireRole([0, 1, 4]), async (c) => {
  const id = c.req.param("id");
  if (!id) throw badRequest("Missing id parameter", "MISSING_PARAM");
  const service = new ReservationService(c.env.DB, c.env);

  await requireReservationAccess(c, service, id);
  const noShow = await service.markNoShow(id);

  return c.json({
    success: true,
    data: noShow,
    message: "已標記未到店",
  });
});

/**
 * GET /reservations/stats/:restaurantId
 * 取得訂位統計
 */
app.get("/stats/:restaurantId", requireRole([0, 1]), async (c) => {
  const restaurantId = c.req.param("restaurantId");
  if (!restaurantId)
    throw badRequest("Missing restaurantId parameter", "MISSING_PARAM");
  const date = c.req.query("date"); // YYYY-MM-DD
  const service = new ReservationService(c.env.DB, c.env);

  // 權限檢查
  const user = c.get("user");
  if (user.role !== 0 && restaurantId !== user.restaurantId!.toString()) {
    throw forbidden("無權限查看此統計");
  }

  const stats = await service.getReservationStats(restaurantId, date);

  return c.json({
    success: true,
    data: stats,
  });
});

// ==========================================
// Slot Management Routes - 時段管理
// ==========================================

/**
 * POST /reservations/slots
 * 建立時段
 */
app.post("/slots", requireRole([0, 1]), async (c) => {
  const body = await c.req.json();
  const service = new ReservationService(c.env.DB, c.env);

  // 權限檢查
  const user = c.get("user");
  if (user.role !== 0 && body.restaurantId !== user.restaurantId) {
    throw forbidden("無權限建立時段");
  }

  const slot = await service.createSlot(body);

  return c.json({
    success: true,
    data: slot,
    message: "時段建立成功",
  });
});

/**
 * POST /reservations/slots/batch
 * 批次建立時段
 */
app.post("/slots/batch", requireRole([0, 1]), async (c) => {
  const body = await c.req.json();
  const service = new ReservationService(c.env.DB, c.env);

  // 權限檢查
  const user = c.get("user");
  if (user.role !== 0 && body.restaurantId !== user.restaurantId) {
    throw forbidden("無權限建立時段");
  }

  const count = await service.batchCreateSlots(body);

  return c.json({
    success: true,
    data: { created: count },
    message: `成功建立 ${count} 個時段`,
  });
});

export default app;
