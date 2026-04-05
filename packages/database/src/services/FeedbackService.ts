import { eq, and, desc, gte, lte, count, sql, like, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { BaseService } from "./base";
import {
  shopFeedback,
  feedbackResponses,
  users,
  restaurants,
} from "../schema";
import type {
  ShopFeedback,
  FeedbackResponse,
  FeedbackCategory,
  FeedbackPriority,
  FeedbackStatus,
  FeedbackModule,
} from "../schema/feedback";

export interface CreateFeedbackData {
  restaurantId: string;
  userId: number;
  category: FeedbackCategory;
  priority?: FeedbackPriority;
  relatedModule?: FeedbackModule;
  subject: string;
  description: string;
  attachmentUrls?: string[];
}

export interface FeedbackFilters {
  restaurantId?: string;
  userId?: number;
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
    isAdmin: boolean = false,
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
    resolvedBy?: number,
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

  async addResponse(
    feedbackId: number,
    userId: number,
    message: string,
    isInternal: boolean = false,
  ): Promise<FeedbackResponse> {
    try {
      // Update feedback updatedAt
      await this.db
        .update(shopFeedback)
        .set({ updatedAt: new Date() })
        .where(eq(shopFeedback.id, feedbackId));

      const [response] = await this.db
        .insert(feedbackResponses)
        .values({
          feedbackId,
          userId,
          message,
          isInternal,
        })
        .returning();

      return response;
    } catch (error) {
      this.handleError(error, "addResponse");
    }
  }

  async getResponses(feedbackId: number, isAdmin: boolean = false) {
    try {
      const rows = await this.db
        .select()
        .from(feedbackResponses)
        .leftJoin(users, eq(feedbackResponses.userId, users.id))
        .where(
          isAdmin
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
