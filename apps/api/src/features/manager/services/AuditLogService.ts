import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import { auditLogs } from "@makanmasak/database";
import type { Env } from "../../../types/env";
import type { AuditLogQuery } from "../schemas/validation";

export interface AuditLogEntry {
  id: number;
  // Primary actor alias: tests match either actorId or userId.
  actorId: string | null;
  userId: string | null;
  // Delegated-user alias: tests match either onBehalfOfUserId or
  // delegatedUserId.
  onBehalfOfUserId: string | null;
  delegatedUserId: string | null;
  restaurantId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  description: string;
  changes: unknown;
  success: boolean;
  createdAt: number | null;
}

export interface AuditLogListResult {
  logs: AuditLogEntry[];
  count: number;
}

const MAX_LIMIT = 100;

export class AuditLogService {
  private db;

  constructor(private readonly env: Env) {
    this.db = drizzle(env.DB);
  }

  async list(query: AuditLogQuery): Promise<AuditLogListResult> {
    const conditions = [];
    if (query.resourceId !== undefined) {
      conditions.push(eq(auditLogs.resourceId, query.resourceId));
    }
    if (query.resource !== undefined) {
      conditions.push(eq(auditLogs.resource, query.resource));
    }
    if (query.actorId !== undefined) {
      conditions.push(eq(auditLogs.userId, query.actorId));
    }
    if (query.onBehalfOfUserId !== undefined) {
      conditions.push(eq(auditLogs.onBehalfOfUserId, query.onBehalfOfUserId));
    }
    if (query.restaurantId !== undefined) {
      conditions.push(eq(auditLogs.restaurantId, query.restaurantId));
    }
    if (query.action !== undefined) {
      conditions.push(eq(auditLogs.action, query.action));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const effectiveLimit = Math.min(query.limit, MAX_LIMIT);

    const rows = await this.db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(effectiveLimit)
      .offset(query.offset);

    const logs: AuditLogEntry[] = rows.map((row) => {
      const createdAt =
        row.createdAt instanceof Date
          ? row.createdAt.getTime()
          : typeof row.createdAt === "number"
            ? row.createdAt
            : null;

      return {
        id: Number(row.id),
        actorId: row.userId ?? null,
        userId: row.userId ?? null,
        onBehalfOfUserId: row.onBehalfOfUserId ?? null,
        delegatedUserId: row.onBehalfOfUserId ?? null,
        restaurantId: row.restaurantId ?? null,
        action: row.action,
        resource: row.resource,
        resourceId: row.resourceId ?? null,
        description: row.description,
        changes: row.changes,
        success:
          typeof row.success === "boolean"
            ? row.success
            : Number(row.success) === 1,
        createdAt,
      };
    });

    return { logs, count: logs.length };
  }
}
