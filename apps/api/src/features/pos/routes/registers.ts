/**
 * 收銀機路由
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import { RegisterService } from "../services/RegisterService";
import {
  createRegisterSchema,
  registerParamsSchema,
  registerQuerySchema,
} from "../schemas";
import type { Env } from "../../../types/env";
import {
  forbidden,
  badRequest,
  notFound,
} from "../../../shared/utils/api-error";

const app = new Hono<{ Bindings: Env }>();

/**
 * 創建收銀機
 * POST /registers
 */
app.post(
  "/",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateBody(createRegisterSchema),
  async (c) => {
    const data = c.get("validatedBody");
    const user = c.get("user");

    // 權限檢查：店主只能為自己的餐廳創建收銀機
    if (user.role === 1 && user.restaurantId !== data.restaurantId) {
      throw forbidden("只能為自己的餐廳創建收銀機");
    }

    const registerService = new RegisterService(c.env.DB);
    const result = await registerService.createRegister(data, user.id);

    if (!result.success) {
      throw badRequest(result.error || "創建收銀機失敗");
    }

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * 獲取收銀機列表
 * GET /registers
 */
app.get("/", authMiddleware, validateQuery(registerQuerySchema), async (c) => {
  const user = c.get("user");
  const query = c.get("validatedQuery");

  // 確定餐廳ID
  let restaurantId: string | undefined;
  if (query.restaurantId) {
    restaurantId = query.restaurantId;
    // 權限檢查
    if (user.role === 1 && user.restaurantId !== restaurantId) {
      throw forbidden("只能查看自己餐廳的收銀機");
    }
  } else if (user.restaurantId) {
    restaurantId = String(user.restaurantId);
  } else {
    throw badRequest("需要指定餐廳ID");
  }

  const registerService = new RegisterService(c.env.DB);
  const result = await registerService.getRegisters(restaurantId!);

  if (!result.success) {
    throw badRequest(result.error || "獲取收銀機列表失敗");
  }

  return c.json({
    success: true,
    data: result.data,
  });
});

/**
 * 獲取收銀機狀態
 * GET /registers/:registerId/status
 */
app.get(
  "/:registerId/status",
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateParams(registerParamsSchema),
  async (c) => {
    const { registerId } = c.get("validatedParams");

    const registerService = new RegisterService(c.env.DB);
    const result = await registerService.getRegisterStatus(registerId);

    if (!result.success) {
      if (result.error === "收銀機不存在") {
        throw notFound("收銀機不存在", "REGISTER_NOT_FOUND");
      }
      throw badRequest(result.error || "獲取收銀機狀態失敗");
    }

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * 更新收銀機
 * PUT /registers/:registerId
 */
app.put(
  "/:registerId",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(registerParamsSchema),
  validateBody(createRegisterSchema.partial()),
  async (c) => {
    const { registerId } = c.get("validatedParams");
    const data = c.get("validatedBody");

    const registerService = new RegisterService(c.env.DB);
    const result = await registerService.updateRegister(registerId, data);

    if (!result.success) {
      throw badRequest(result.error || "更新收銀機失敗");
    }

    return c.json({
      success: true,
      data: result.data,
    });
  },
);

/**
 * 啟用收銀機
 * POST /registers/:registerId/activate
 */
app.post(
  "/:registerId/activate",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(registerParamsSchema),
  async (c) => {
    const { registerId } = c.get("validatedParams");

    const registerService = new RegisterService(c.env.DB);
    const result = await registerService.toggleRegisterStatus(registerId, true);

    if (!result.success) {
      throw badRequest(result.error || "啟用收銀機失敗");
    }

    return c.json({
      success: true,
      message: "收銀機已啟用",
    });
  },
);

/**
 * 停用收銀機
 * POST /registers/:registerId/deactivate
 */
app.post(
  "/:registerId/deactivate",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(registerParamsSchema),
  async (c) => {
    const { registerId } = c.get("validatedParams");

    const registerService = new RegisterService(c.env.DB);
    const result = await registerService.toggleRegisterStatus(
      registerId,
      false,
    );

    if (!result.success) {
      throw badRequest(result.error || "停用收銀機失敗");
    }

    return c.json({
      success: true,
      message: "收銀機已停用",
    });
  },
);

/**
 * 刪除收銀機
 * DELETE /registers/:registerId
 */
app.delete(
  "/:registerId",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(registerParamsSchema),
  async (c) => {
    const { registerId } = c.get("validatedParams");

    const registerService = new RegisterService(c.env.DB);
    const result = await registerService.deleteRegister(registerId);

    if (!result.success) {
      throw badRequest(result.error || "刪除收銀機失敗");
    }

    return c.json({
      success: true,
      message: "收銀機已刪除",
    });
  },
);

export default app;
