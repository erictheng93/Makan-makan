/**
 * 列印代理憑證與健康狀態
 *
 * 憑證綁定餐廳，可選擇再綁一台收銀機：綁了就是櫃檯出單機，只拿該台的收據；
 * 不綁就是全店代理，拿沒有收銀機的收據（訂單確認時自動產生的廚房票）。
 * 雲端的租戶範圍是從憑證本身推導的，代理沒有任何可以自報餐廳的管道。
 */

import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, isNull } from "drizzle-orm";
import { cashRegisters, printAgents } from "@makanmasak/database";
import { generateUUID } from "@makanmasak/utils";
import {
  generatePrintAgentKey,
  hashPrintAgentKey,
} from "../../../shared/utils/print-agent-key";

/**
 * 超過這段時間沒有輪詢就算離線。代理預設每 60 秒輪詢一次，所以五分鐘代表連續
 * 錯過數次，而不是單次網路抖動。
 */
const OFFLINE_AFTER_MS = 5 * 60 * 1000;

export type PrintAgentStatus =
  | "online"
  | "no_printer"
  | "offline"
  | "never_seen";

export interface PrintAgentSummary {
  id: string;
  restaurantId: string;
  /** null = 全店代理（廚房出單機之類），不綁單一收銀機。 */
  registerId: string | null;
  registerName: string | null;
  label: string;
  status: PrintAgentStatus;
  printersTotal: number | null;
  printersOnline: number | null;
  lastSeenAt?: Date;
  createdAt: Date;
}

/**
 * 健康判定放在伺服器端，讓「這家店的印表機掛了」在所有介面上是同一個定義。
 *
 * `no_printer` 是這次要補的那個區別：代理活著、有在輪詢，但它手上一台印表機
 * 都沒有上線 —— 只看 lastSeenAt 的話這與完全正常無法分辨。
 */
function statusOf(
  lastSeenAt: Date | null,
  printersTotal: number | null,
  printersOnline: number | null,
  now: number,
): PrintAgentStatus {
  if (!lastSeenAt) return "never_seen";
  if (now - lastSeenAt.getTime() > OFFLINE_AFTER_MS) return "offline";
  if (printersTotal !== null && (printersOnline ?? 0) === 0) {
    return "no_printer";
  }
  return "online";
}

export class PrintAgentCredentialService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 這台收銀機是否屬於該餐廳。核發時用來擋「拿別家店的 registerId 綁上來」。
   */
  async registerBelongsToRestaurant(
    restaurantId: string,
    registerId: string,
  ): Promise<boolean> {
    const [register] = await this.db
      .select({ id: cashRegisters.id })
      .from(cashRegisters)
      .where(
        and(
          eq(cashRegisters.id, registerId),
          eq(cashRegisters.restaurantId, restaurantId),
        ),
      )
      .limit(1);

    return Boolean(register);
  }

  /**
   * 列出整間店尚未撤銷的代理與健康狀態。不含金鑰本身 —— 只有核發當下看得到明文。
   */
  async listAgents(
    restaurantId: string,
    now = Date.now(),
  ): Promise<PrintAgentSummary[]> {
    const rows = await this.db
      .select({
        id: printAgents.id,
        restaurantId: printAgents.restaurantId,
        registerId: printAgents.registerId,
        registerName: cashRegisters.name,
        label: printAgents.label,
        printersTotal: printAgents.printersTotal,
        printersOnline: printAgents.printersOnline,
        lastSeenAt: printAgents.lastSeenAt,
        createdAt: printAgents.createdAt,
      })
      .from(printAgents)
      .leftJoin(cashRegisters, eq(cashRegisters.id, printAgents.registerId))
      .where(
        and(
          eq(printAgents.restaurantId, restaurantId),
          isNull(printAgents.revokedAt),
        ),
      )
      .orderBy(desc(printAgents.createdAt));

    return rows.map((row) => ({
      ...row,
      status: statusOf(
        row.lastSeenAt,
        row.printersTotal,
        row.printersOnline,
        now,
      ),
      lastSeenAt: row.lastSeenAt ?? undefined,
    }));
  }

  /**
   * 核發新憑證。明文金鑰只在這裡回傳一次，之後就只剩摘要 —— 弄丟就重發一把
   * 並撤銷舊的，不能還原。
   */
  async issueAgent(
    restaurantId: string,
    label: string,
    registerId?: string,
  ): Promise<{ agent: PrintAgentSummary; key: string }> {
    const key = generatePrintAgentKey();
    const now = new Date();
    const id = generateUUID();

    await this.db.insert(printAgents).values({
      id,
      restaurantId,
      registerId: registerId ?? null,
      label,
      keyHash: await hashPrintAgentKey(key),
      createdAt: now,
      updatedAt: now,
    });

    return {
      agent: {
        id,
        restaurantId,
        registerId: registerId ?? null,
        registerName: null,
        label,
        status: "never_seen",
        printersTotal: null,
        printersOnline: null,
        createdAt: now,
      },
      key,
    };
  }

  /**
   * 撤銷憑證。以 restaurantId 一併過濾，別家店的代理撤不到。已撤銷的再撤一次
   * 回 false。
   */
  async revokeAgent(restaurantId: string, agentId: string): Promise<boolean> {
    const now = new Date();
    const revoked = await this.db
      .update(printAgents)
      .set({ revokedAt: now, updatedAt: now })
      .where(
        and(
          eq(printAgents.id, agentId),
          eq(printAgents.restaurantId, restaurantId),
          isNull(printAgents.revokedAt),
        ),
      )
      .returning({ id: printAgents.id });

    return revoked.length > 0;
  }
}
