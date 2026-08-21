/**
 * 列印代理憑證與健康狀態
 *
 * 端點掛在餐廳層級而不是收銀機底下：全店代理（廚房出單機）沒有收銀機可以掛，
 * 而後台要看的是「這家店的出單狀況」，不是逐台收銀機去點。
 *
 * 餐廳範圍一律取自登入者，不接受 body 或 query 指定 —— 這條路徑核發的金鑰
 * 本身就是雲端的租戶邊界，能指定餐廳就等於能核發別家店的金鑰。
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { validateBody, validateParams } from "../../../middleware/validation";
import { PrintAgentCredentialService } from "../services/PrintAgentCredentialService";
import { issuePrintAgentSchema, printAgentParamsSchema } from "../schemas";
import type { Env } from "../../../types/env";
import {
  badRequest,
  forbidden,
  notFound,
} from "../../../shared/utils/api-error";

const app = new Hono<{ Bindings: Env }>();

/**
 * 平台管理員（role 0）不綁餐廳，必須明講要哪一家；其他角色一律鎖回自己的。
 */
function resolveRestaurantId(c: {
  get(key: "user"): { role: number; restaurantId?: string | number };
  req: { query(key: string): string | undefined };
}): string {
  const user = c.get("user");

  if (user.role === 0) {
    const requested = c.req.query("restaurantId");
    if (!requested) {
      throw badRequest(
        "平台管理員需指定 restaurantId",
        "RESTAURANT_ID_REQUIRED",
      );
    }
    return requested;
  }

  if (!user.restaurantId) {
    throw forbidden("此帳號未綁定餐廳");
  }
  return String(user.restaurantId);
}

/**
 * 列出本店的列印代理與健康狀態
 * GET /print-agents
 */
app.get(
  "/",
  authMiddleware,
  requireRole([0, 1, 4]), // Admin, Owner, Cashier
  async (c) => {
    const service = new PrintAgentCredentialService(c.env.DB);

    return c.json({
      success: true,
      data: await service.listAgents(resolveRestaurantId(c)),
    });
  },
);

/**
 * 核發列印代理憑證
 * POST /print-agents
 */
app.post(
  "/",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateBody(issuePrintAgentSchema),
  async (c) => {
    const { label, registerId } = c.get("validatedBody");
    const restaurantId = resolveRestaurantId(c);
    const service = new PrintAgentCredentialService(c.env.DB);

    // 不綁收銀機是合法的（廚房出單機）；綁了就必須是自己店裡那一台。
    if (
      registerId &&
      !(await service.registerBelongsToRestaurant(restaurantId, registerId))
    ) {
      throw notFound("收銀機不存在", "REGISTER_NOT_FOUND");
    }

    const { agent, key } = await service.issueAgent(
      restaurantId,
      label,
      registerId,
    );

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
 * DELETE /print-agents/:agentId
 */
app.delete(
  "/:agentId",
  authMiddleware,
  requireRole([0, 1]), // Admin or Owner
  validateParams(printAgentParamsSchema),
  async (c) => {
    const { agentId } = c.get("validatedParams");
    const service = new PrintAgentCredentialService(c.env.DB);

    if (!(await service.revokeAgent(resolveRestaurantId(c), agentId))) {
      throw notFound("列印代理不存在", "PRINT_AGENT_NOT_FOUND");
    }

    return c.json({
      success: true,
      message: "列印代理憑證已撤銷",
    });
  },
);

export default app;
