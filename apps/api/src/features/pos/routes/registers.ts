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
    try {
      const data = c.get("validatedBody");
      const user = c.get("user");

      // 權限檢查：店主只能為自己的餐廳創建收銀機
      if (user.role === 1 && user.restaurantId !== data.restaurantId) {
        return c.json(
          {
            success: false,
            error: "只能為自己的餐廳創建收銀機",
          },
          403,
        );
      }

      const registerService = new RegisterService(c.env.DB as any);
      const result = await registerService.createRegister(data, user.id);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          400,
        );
      }

      return c.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error("Create register error:", error);
      return c.json(
        {
          success: false,
          error: "創建收銀機失敗",
        },
        500,
      );
    }
  },
);

/**
 * 獲取收銀機列表
 * GET /registers
 */
app.get("/", authMiddleware, validateQuery(registerQuerySchema), async (c) => {
  try {
    const user = c.get("user");
    const query = c.get("validatedQuery");

    // 確定餐廳ID
    let restaurantId: string | undefined;
    if (query.restaurantId) {
      restaurantId = String(query.restaurantId);
      // 權限檢查
      if (user.role === 1 && user.restaurantId !== restaurantId) {
        return c.json(
          {
            success: false,
            error: "只能查看自己餐廳的收銀機",
          },
          403,
        );
      }
    } else if (user.restaurantId) {
      restaurantId = user.restaurantId;
    } else {
      return c.json(
        {
          success: false,
          error: "需要指定餐廳ID",
        },
        400,
      );
    }

    const registerService = new RegisterService(c.env.DB as any);
    const result = await registerService.getRegisters(restaurantId!);

    if (!result.success) {
      return c.json(
        {
          success: false,
          error: result.error,
        },
        400,
      );
    }

    return c.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    console.error("Get registers error:", error);
    return c.json(
      {
        success: false,
        error: "獲取收銀機列表失敗",
      },
      500,
    );
  }
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
    try {
      const { registerId } = c.get("validatedParams");

      const registerService = new RegisterService(c.env.DB as any);
      const result = await registerService.getRegisterStatus(registerId);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          result.error === "收銀機不存在" ? 404 : 400,
        );
      }

      return c.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error("Get register status error:", error);
      return c.json(
        {
          success: false,
          error: "獲取收銀機狀態失敗",
        },
        500,
      );
    }
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
    try {
      const { registerId } = c.get("validatedParams");
      const data = c.get("validatedBody");

      const registerService = new RegisterService(c.env.DB as any);
      const result = await registerService.updateRegister(registerId, data);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          400,
        );
      }

      return c.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      console.error("Update register error:", error);
      return c.json(
        {
          success: false,
          error: "更新收銀機失敗",
        },
        500,
      );
    }
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
    try {
      const { registerId } = c.get("validatedParams");

      const registerService = new RegisterService(c.env.DB as any);
      const result = await registerService.toggleRegisterStatus(
        registerId,
        true,
      );

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          400,
        );
      }

      return c.json({
        success: true,
        message: "收銀機已啟用",
      });
    } catch (error) {
      console.error("Activate register error:", error);
      return c.json(
        {
          success: false,
          error: "啟用收銀機失敗",
        },
        500,
      );
    }
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
    try {
      const { registerId } = c.get("validatedParams");

      const registerService = new RegisterService(c.env.DB as any);
      const result = await registerService.toggleRegisterStatus(
        registerId,
        false,
      );

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          400,
        );
      }

      return c.json({
        success: true,
        message: "收銀機已停用",
      });
    } catch (error) {
      console.error("Deactivate register error:", error);
      return c.json(
        {
          success: false,
          error: "停用收銀機失敗",
        },
        500,
      );
    }
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
    try {
      const { registerId } = c.get("validatedParams");

      const registerService = new RegisterService(c.env.DB as any);
      const result = await registerService.deleteRegister(registerId);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          400,
        );
      }

      return c.json({
        success: true,
        message: "收銀機已刪除",
      });
    } catch (error) {
      console.error("Delete register error:", error);
      return c.json(
        {
          success: false,
          error: "刪除收銀機失敗",
        },
        500,
      );
    }
  },
);

export default app;
