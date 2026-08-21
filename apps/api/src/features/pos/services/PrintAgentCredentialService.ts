/**
 * 列印代理憑證管理
 *
 * 每台店內列印代理有自己的金鑰，而且金鑰綁定到單一收銀機。雲端就是靠這個
 * 綁定推導租戶範圍的 —— 代理不再自己宣告要哪一家餐廳的收據。
 */

import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, isNull } from "drizzle-orm";
import { printAgents } from "@makanmasak/database";
import { generateUUID } from "@makanmasak/utils";
import {
  generatePrintAgentKey,
  hashPrintAgentKey,
} from "../../../shared/utils/print-agent-key";

export interface PrintAgentSummary {
  id: string;
  registerId: string;
  label: string;
  lastSeenAt?: Date;
  createdAt: Date;
}

export class PrintAgentCredentialService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  /**
   * 列出尚未撤銷的憑證。不含金鑰本身 —— 只有核發當下看得到明文。
   */
  async listAgents(registerId: string): Promise<PrintAgentSummary[]> {
    const rows = await this.db
      .select({
        id: printAgents.id,
        registerId: printAgents.registerId,
        label: printAgents.label,
        lastSeenAt: printAgents.lastSeenAt,
        createdAt: printAgents.createdAt,
      })
      .from(printAgents)
      .where(
        and(
          eq(printAgents.registerId, registerId),
          isNull(printAgents.revokedAt),
        ),
      )
      .orderBy(desc(printAgents.createdAt));

    return rows.map((row) => ({
      ...row,
      lastSeenAt: row.lastSeenAt ?? undefined,
    }));
  }

  /**
   * 核發新憑證。明文金鑰只在這裡回傳一次，之後就只剩摘要 —— 弄丟就重發一把
   * 並撤銷舊的，不能還原。
   */
  async issueAgent(
    registerId: string,
    label: string,
  ): Promise<{ agent: PrintAgentSummary; key: string }> {
    const key = generatePrintAgentKey();
    const now = new Date();
    const agent = {
      id: generateUUID(),
      registerId,
      label,
      keyHash: await hashPrintAgentKey(key),
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(printAgents).values(agent);

    return {
      agent: {
        id: agent.id,
        registerId,
        label,
        createdAt: now,
      },
      key,
    };
  }

  /**
   * 撤銷憑證。以 registerId 一併過濾，這樣某台收銀機的管理者不會撤銷到別台的
   * 代理。已撤銷的再撤一次回 false。
   */
  async revokeAgent(registerId: string, agentId: string): Promise<boolean> {
    const revoked = await this.db
      .update(printAgents)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(printAgents.id, agentId),
          eq(printAgents.registerId, registerId),
          isNull(printAgents.revokedAt),
        ),
      )
      .returning({ id: printAgents.id });

    return revoked.length > 0;
  }
}
