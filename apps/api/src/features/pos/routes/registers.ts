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
  issuePrintAgentSchema,
  printAgentParamsSchema,
  registerParamsSchema,
  registerQuerySchema,
} from "../schemas";
import { PrintAgentCredentialService } from "../services/PrintAgentCredentialService";
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

/**
 * 列印代理憑證
 *
 * 這台收銀機的代理靠這把金鑰認證，雲端再從金鑰推導出收銀機與餐廳。金鑰換句話
 * 說就是租戶邊界本身，所以這三支端點都必須確認呼叫者真的擁有這台收銀機 ——
 * requireRole([0, 1]) 只擋到角色，擋不到「別家店的店主」。
 */
async function requireRegisterOwnership(
  c: { get(key: "user"): AuthUser; env: Env },
  registerId: string,
): Promise<PrintAgentCredentialService> {
  const user = c.get("user");
  const service = new PrintAgentCredentialService(c.env.DB);
  const restaurantId = await service.getRegisterRestaurantId(registerId);

  if (!restaurantId) {
    throw notFound("收銀機不存在", "REGISTER_NOT_FOUND");
  }
  if (user.role !== 0 && user.restaurantId !== restaurantId) {
    throw forbidden("只能管理自己餐廳的收銀機");
  }

  return service;
}

/**
 * 列出收銀機的列印代理
 * GET /registers/:registerId/print-agents
 */
app.get(
  "/:registerId/print-agents",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(registerParamsSchema),
  async (c) => {
    const { registerId } = c.get("validatedParams");
    const service = await requireRegisterOwnership(c, registerId);

    return c.json({
      success: true,
      data: await service.listAgents(registerId),
    });
  },
);

/**
 * 核發列印代理憑證
 * POST /registers/:registerId/print-agents
 */
app.post(
  "/:registerId/print-agents",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(registerParamsSchema),
  validateBody(issuePrintAgentSchema),
  async (c) => {
    const { registerId } = c.get("validatedParams");
    const { label } = c.get("validatedBody");
    const service = await requireRegisterOwnership(c, registerId);

    const { agent, key } = await service.issueAgent(registerId, label);

    return c.json({
      success: true,
      data: {
        ...agent,
        // 只有這一次看得到。伺服器只留摘要，弄丟就撤銷重發。
        key,
      },
      message: "請立即保存金鑰，離開此畫面後無法再取得",
    });
  },
);

/**
 * 撤銷列印代理憑證
 * DELETE /registers/:registerId/print-agents/:agentId
 */
app.delete(
  "/:registerId/print-agents/:agentId",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(printAgentParamsSchema),
  async (c) => {
    const { registerId, agentId } = c.get("validatedParams");
    const service = await requireRegisterOwnership(c, registerId);

    if (!(await service.revokeAgent(registerId, agentId))) {
      throw notFound("列印代理不存在", "PRINT_AGENT_NOT_FOUND");
    }

    return c.json({
      success: true,
      message: "列印代理憑證已撤銷",
    });
  },
);

export default app;
