import type { SQL } from "drizzle-orm";
import { and, count, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { feedbackResponses, restaurants, shopFeedback, users } from "../schema";
import type {
  FeedbackCategory,
  FeedbackModule,
  FeedbackPriority,
  FeedbackResponse,
  FeedbackStatus,
  ShopFeedback,
} from "../schema/feedback";
import { BaseService } from "./base";

export interface CreateFeedbackData {
  restaurantId: string;
  userId: string;
  category: FeedbackCategory;
  priority?: FeedbackPriority;
  relatedModule?: FeedbackModule;
  subject: string;
  description: string;
  attachmentUrls?: string[];
}

export interface UpdateFeedbackData {
  category?: FeedbackCategory;
  priority?: FeedbackPriority;
  relatedModule?: FeedbackModule;
  subject?: string;
  description?: string;
  attachmentUrls?: string[];
}

export interface FeedbackFilters {
  restaurantId?: string;
  userId?: string;
  category?: FeedbackCategory;
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  relatedModule?: FeedbackModule;
  search?: string;
  dateRange?: [Date, Date];
}

export interface FeedbackStats {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  avgResolutionTimeMs: number | null;
}

export class FeedbackService extends BaseService {
  private buildWhereClause(filters: FeedbackFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.restaurantId) {
      conditions.push(eq(shopFeedback.restaurantId, filters.restaurantId));
    }

    if (filters.userId) {
      conditions.push(eq(shopFeedback.userId, filters.userId));
    }

    if (filters.category) {
      conditions.push(eq(shopFeedback.category, filters.category));
    }

    if (filters.status) {
      conditions.push(eq(shopFeedback.status, filters.status));
    }

    if (filters.priority) {
      conditions.push(eq(shopFeedback.priority, filters.priority));
    }

    if (filters.relatedModule) {
      conditions.push(eq(shopFeedback.relatedModule, filters.relatedModule));
    }

    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          like(shopFeedback.subject, term),
          like(shopFeedback.description, term),
        ) as SQL,
      );
    }

    if (filters.dateRange) {
      conditions.push(
        and(
          gte(shopFeedback.createdAt, filters.dateRange[0]),
          lte(shopFeedback.createdAt, filters.dateRange[1]),
        ) as SQL,
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async createFeedback(data: CreateFeedbackData): Promise<ShopFeedback> {
    try {
      const [feedback] = await this.db
        .insert(shopFeedback)
        .values({
          restaurantId: data.restaurantId,
          userId: data.userId,
          category: data.category,
          priority: data.priority ?? "medium",
          relatedModule: data.relatedModule ?? "other",
          subject: data.subject,
          description: data.description,
          attachmentUrls: data.attachmentUrls
            ? JSON.stringify(data.attachmentUrls)
            : null,
        })
        .returning();

      return feedback;
    } catch (error) {
      this.handleError(error, "createFeedback");
    }
  }

  async getFeedbackById(id: number) {
    try {
      const [row] = await this.db
        .select()
        .from(shopFeedback)
        .leftJoin(users, eq(shopFeedback.userId, users.id))
        .leftJoin(restaurants, eq(shopFeedback.restaurantId, restaurants.id))
        .where(eq(shopFeedback.id, id));

      if (!row) return null;

      const responses = await this.getResponses(id, true);

      return {
        ...row.shop_feedback,
        attachmentUrls: row.shop_feedback.attachmentUrls
          ? JSON.parse(row.shop_feedback.attachmentUrls)
          : [],
        user: row.users,
        restaurant: row.restaurants,
        responses,
      };
    } catch (error) {
      this.handleError(error, "getFeedbackById");
    }
  }

  async listFeedback(
    filters: FeedbackFilters = {},
    page: number = 1,
    limit: number = 20,
    _isAdmin: boolean = false,
  ) {
    try {
      const whereClause = this.buildWhereClause(filters);
      const { offset } = this.createPagination(page, limit);

      const rows = await this.db
        .select()
        .from(shopFeedback)
        .leftJoin(users, eq(shopFeedback.userId, users.id))
        .leftJoin(restaurants, eq(shopFeedback.restaurantId, restaurants.id))
        .where(whereClause)
        .orderBy(desc(shopFeedback.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ total }] = await this.db
        .select({ total: count() })
        .from(shopFeedback)
        .where(whereClause);

      return {
        feedback: rows.map((row) => ({
          ...row.shop_feedback,
          attachmentUrls: row.shop_feedback.attachmentUrls
            ? JSON.parse(row.shop_feedback.attachmentUrls)
            : [],
          user: row.users,
          restaurant: row.restaurants,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.handleError(error, "listFeedback");
    }
  }

  async updateFeedbackStatus(
    id: number,
    status: FeedbackStatus,
    resolvedBy?: string,
  ): Promise<ShopFeedback> {
    try {
      const now = new Date();
      const updateData: Partial<typeof shopFeedback.$inferInsert> = {
        status,
        updatedAt: now,
      };

      if (status === "resolved" && resolvedBy) {
        updateData.resolvedAt = now;
        updateData.resolvedBy = resolvedBy;
      }

      const [updated] = await this.db
        .update(shopFeedback)
        .set(updateData)
        .where(eq(shopFeedback.id, id))
        .returning();

      if (!updated) {
        throw new Error("Feedback not found");
      }

      return updated;
    } catch (error) {
      this.handleError(error, "updateFeedbackStatus");
    }
  }

  async updateFeedback(
    id: number,
    data: UpdateFeedbackData,
    userId: string,
    _isAdmin: boolean = false,
  ): Promise<ShopFeedback | null> {
    try {
      const whereClause = _isAdmin
        ? eq(shopFeedback.id, id)
        : and(
            eq(shopFeedback.id, id),
            eq(shopFeedback.userId, userId),
            eq(shopFeedback.status, "open"),
          );

      const updatePayload: Partial<typeof shopFeedback.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (data.category !== undefined) updatePayload.category = data.category;
      if (data.priority !== undefined) updatePayload.priority = data.priority;
      if (data.relatedModule !== undefined)
        updatePayload.relatedModule = data.relatedModule;
      if (data.subject !== undefined) updatePayload.subject = data.subject;
      if (data.description !== undefined)
        updatePayload.description = data.description;
      if (data.attachmentUrls !== undefined) {
        updatePayload.attachmentUrls = JSON.stringify(data.attachmentUrls);
      }

      const [updated] = await this.db
        .update(shopFeedback)
        .set(updatePayload)
        .where(whereClause)
        .returning();

      return updated ?? null;
    } catch (error) {
      this.handleError(error, "updateFeedback");
    }
  }

  async deleteFeedback(
    id: number,
    userId: string,
    _isAdmin: boolean = false,
  ): Promise<boolean> {
    try {
      const whereClause = _isAdmin
        ? eq(shopFeedback.id, id)
        : and(
            eq(shopFeedback.id, id),
            eq(shopFeedback.userId, userId),
            eq(shopFeedback.status, "open"),
          );
      const authorizedFeedbackFilter = _isAdmin
        ? sql`id = ${id}`
        : sql`id = ${id} AND user_id = ${userId} AND status = 'open'`;

      const [, deletedRows] = await this.db.batch([
        this.db.delete(feedbackResponses).where(
          sql`${feedbackResponses.feedbackId} IN (
              SELECT id FROM shop_feedback WHERE ${authorizedFeedbackFilter}
            )`,
        ) as BatchItem<"sqlite">,
        this.db
          .delete(shopFeedback)
          .where(whereClause)
          .returning({ id: shopFeedback.id }) as BatchItem<"sqlite">,
      ]);
      return (deletedRows as Array<{ id: number }>).length > 0;
    } catch (error) {
      this.handleError(error, "deleteFeedback");
    }
  }

  async addResponse(
    feedbackId: number,
    userId: string,
    message: string,
    isInternal: boolean = false,
  ): Promise<FeedbackResponse> {
    try {
      const [, responseRows] = await this.db.batch([
        this.db
          .update(shopFeedback)
          .set({ updatedAt: new Date() })
          .where(eq(shopFeedback.id, feedbackId)) as BatchItem<"sqlite">,
        this.db
          .insert(feedbackResponses)
          .values({
            feedbackId,
            userId,
            message,
            isInternal,
          })
          .returning() as BatchItem<"sqlite">,
      ]);

      return (responseRows as FeedbackResponse[])[0];
    } catch (error) {
      this.handleError(error, "addResponse");
    }
  }

  async getResponses(feedbackId: number, _isAdmin: boolean = false) {
    try {
      const rows = await this.db
        .select()
        .from(feedbackResponses)
        .leftJoin(users, eq(feedbackResponses.userId, users.id))
        .where(
          _isAdmin
            ? eq(feedbackResponses.feedbackId, feedbackId)
            : and(
                eq(feedbackResponses.feedbackId, feedbackId),
                eq(feedbackResponses.isInternal, false),
              ),
        )
        .orderBy(feedbackResponses.createdAt);

      return rows.map((row) => ({
        ...row.feedback_responses,
        user: row.users,
      }));
    } catch (error) {
      this.handleError(error, "getResponses");
    }
  }

  async updateResponse(
    responseId: number,
    userId: string,
    message: string,
    _isAdmin: boolean = false,
  ): Promise<FeedbackResponse | null> {
    try {
      const whereClause = _isAdmin
        ? eq(feedbackResponses.id, responseId)
        : and(
            eq(feedbackResponses.id, responseId),
            eq(feedbackResponses.userId, userId),
          );

      const [updated] = await this.db
        .update(feedbackResponses)
        .set({ message })
        .where(whereClause)
        .returning();

      return updated ?? null;
    } catch (error) {
      this.handleError(error, "updateResponse");
    }
  }

  async deleteResponse(
    responseId: number,
    userId: string,
    _isAdmin: boolean = false,
  ): Promise<boolean> {
    try {
      const whereClause = _isAdmin
        ? eq(feedbackResponses.id, responseId)
        : and(
            eq(feedbackResponses.id, responseId),
            eq(feedbackResponses.userId, userId),
          );

      const result = await this.db
        .delete(feedbackResponses)
        .where(whereClause)
        .returning({ id: feedbackResponses.id });

      return result.length > 0;
    } catch (error) {
      this.handleError(error, "deleteResponse");
    }
  }

  async getFeedbackStats(restaurantId?: string): Promise<FeedbackStats> {
    try {
      const conditions: SQL[] = [];
      if (restaurantId) {
        conditions.push(eq(shopFeedback.restaurantId, restaurantId));
      }
      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [totals] = await this.db
        .select({ total: count() })
        .from(shopFeedback)
        .where(whereClause);

      const statusStats = await this.db
        .select({ status: shopFeedback.status, count: count() })
        .from(shopFeedback)
        .where(whereClause)
        .groupBy(shopFeedback.status);

      const categoryStats = await this.db
        .select({ category: shopFeedback.category, count: count() })
        .from(shopFeedback)
        .where(whereClause)
        .groupBy(shopFeedback.category);

      const priorityStats = await this.db
        .select({ priority: shopFeedback.priority, count: count() })
        .from(shopFeedback)
        .where(whereClause)
        .groupBy(shopFeedback.priority);

      const [avgResolution] = await this.db
        .select({
          avgMs: sql<number>`AVG(${shopFeedback.resolvedAt} - ${shopFeedback.createdAt})`,
        })
        .from(shopFeedback)
        .where(
          and(
            whereClause ?? sql`1=1`,
            sql`${shopFeedback.resolvedAt} IS NOT NULL`,
          ),
        );

      return {
        total: totals?.total ?? 0,
        byStatus: statusStats.reduce(
          (acc, r) => ({ ...acc, [r.status]: r.count }),
          {} as Record<string, number>,
        ),
        byCategory: categoryStats.reduce(
          (acc, r) => ({ ...acc, [r.category]: r.count }),
          {} as Record<string, number>,
        ),
        byPriority: priorityStats.reduce(
          (acc, r) => ({ ...acc, [r.priority]: r.count }),
          {} as Record<string, number>,
        ),
        avgResolutionTimeMs: avgResolution?.avgMs ?? null,
      };
    } catch (error) {
      this.handleError(error, "getFeedbackStats");
    }
  }
}
