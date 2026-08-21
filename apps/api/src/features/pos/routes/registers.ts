/**
 * 收銀機路由
 */

import { Hono } from "hono";
import {
  authMiddleware,
  requireRole,
  type AuthUser,
} from "../../../middleware/auth";
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
 * 確認呼叫者真的擁有這台收銀機。
 *
 * `requireRole([0, 1])` 證明的是「這個人是某家店的店主」，不是「這台收銀機是
 * 他的」—— 少了這一道，帶著別家店的 registerId 就能讀設定、改設定、停用甚至
 * 刪除（#229）。服務層也擋不住：RegisterService 的每個方法都只用
 * `where(eq(cashRegisters.id, registerId))`。
 *
 * 平台管理員（role 0）不綁餐廳，所以跳過。
 *
 * 不存在回 404、別家店回 403：403 因此會洩漏「這個 id 存在」，但 registerId
 * 是 UUID 且清單端點已經鎖回自己餐廳，猜得中才問得出來。這樣與同檔案其他端點
 * 的 REGISTER_NOT_FOUND 行為一致。
 */
async function requireRegisterOwnership(
  c: { get(key: "user"): AuthUser; env: Env },
  registerId: string,
): Promise<void> {
  const user = c.get("user");
  const restaurantId = await new RegisterService(
    c.env.DB,
  ).getRegisterRestaurantId(registerId);

  if (!restaurantId) {
    throw notFound("收銀機不存在", "REGISTER_NOT_FOUND");
  }
  if (user.role !== 0 && String(user.restaurantId) !== restaurantId) {
    throw forbidden("只能管理自己餐廳的收銀機");
  }
}

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
app.get(
  "/",
  authMiddleware,
  // 收銀機清單對廚師（2）與送菜員（3）沒有用途，而在補上角色閘門之前這支只有
  // authMiddleware，任何登入者都進得來。
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  validateQuery(registerQuerySchema),
  async (c) => {
    const user = c.get("user");
    const query = c.get("validatedQuery");

    // 確定餐廳ID
    let restaurantId: string | undefined;
    if (query.restaurantId) {
      restaurantId = query.restaurantId;
      // 租戶檢查。先前只比對 role === 1，於是收銀（4）帶 ?restaurantId= 就能列
      // 舉任意餐廳的收銀機 —— 那份清單含 id，正是 :registerId 端點需要的東西
      // （#229）。restaurantId 在 AuthUser 上是 string | number，所以要轉字串
      // 再比，否則型別不同會恆真。
      if (user.role !== 0 && String(user.restaurantId) !== restaurantId) {
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
  },
);

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
    await requireRegisterOwnership(c, registerId);

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
    await requireRegisterOwnership(c, registerId);

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
    await requireRegisterOwnership(c, registerId);

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
    await requireRegisterOwnership(c, registerId);

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
    await requireRegisterOwnership(c, registerId);

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
