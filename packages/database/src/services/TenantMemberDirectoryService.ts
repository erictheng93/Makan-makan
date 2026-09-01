import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  customerPreferences,
  customers,
  orders,
  restaurantCustomers,
} from "../schema";
import { BaseService } from "./base";

export interface TenantScope {
  readonly restaurantId: string;
}

export interface MemberListFilters {
  page: number;
  limit: number;
  search?: string;
  minOrders?: number;
  minSpentCents?: number;
  lastOrderFrom?: Date;
  lastOrderTo?: Date;
  blocked?: boolean;
  sort?: "recent" | "spent" | "orders" | "name";
}

export interface TenantMemberListItem {
  memberId: string;
  displayName: string;
  maskedPhone: string | null;
  maskedEmail: string | null;
  locale: string | null;
  orderCount: number;
  cancelledOrderCount: number;
  totalSpentCents: number;
  avgOrderValueCents: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  tags: string[] | null;
  isBlocked: boolean;
  marketingReachable: boolean;
  status: "active" | "deleted";
}

export interface MemberListResult {
  members: TenantMemberListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  if (phone.length <= 4) return "*".repeat(phone.length);
  return `${phone.slice(0, Math.min(4, phone.length - 3))}***${phone.slice(
    -3,
  )}`;
}

function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return "*";
  return `${email[0]}***${email.slice(at)}`;
}

/**
 * Read-only tenant projection for member administration. No method accepts a
 * customer id; callers can only address a member through restaurant_customers.
 */
export class TenantMemberDirectoryService extends BaseService {
  private memberProjection() {
    return {
      memberId: restaurantCustomers.id,
      customerId: restaurantCustomers.customerId,
      displayName: customers.displayName,
      phone: customers.primaryPhone,
      email: customers.primaryEmail,
      locale: customers.locale,
      customerStatus: customers.status,
      orderCount: restaurantCustomers.orderCount,
      cancelledOrderCount: restaurantCustomers.cancelledOrderCount,
      totalSpentCents: restaurantCustomers.totalSpentCents,
      firstOrderAt: restaurantCustomers.firstOrderAt,
      lastOrderAt: restaurantCustomers.lastOrderAt,
      tags: restaurantCustomers.tags,
      isBlocked: restaurantCustomers.isBlocked,
      marketingOptIn: customerPreferences.marketingOptIn,
    };
  }

  private toPublicMember(
    row: Awaited<
      ReturnType<TenantMemberDirectoryService["resolveTenantMember"]>
    >,
  ) {
    if (!row) return null;
    return {
      memberId: row.memberId,
      displayName:
        row.customerStatus === "deleted" ? "已刪除的顧客" : row.displayName,
      maskedPhone:
        row.customerStatus === "deleted" ? null : maskPhone(row.phone),
      maskedEmail:
        row.customerStatus === "deleted" ? null : maskEmail(row.email),
      locale: row.locale,
      orderCount: row.orderCount,
      cancelledOrderCount: row.cancelledOrderCount,
      totalSpentCents: row.totalSpentCents,
      avgOrderValueCents:
        row.orderCount === 0
          ? 0
          : Math.round(row.totalSpentCents / row.orderCount),
      firstOrderAt: row.firstOrderAt,
      lastOrderAt: row.lastOrderAt,
      tags: row.tags,
      isBlocked: Boolean(row.isBlocked),
      marketingReachable:
        row.customerStatus === "active" && Boolean(row.marketingOptIn),
      status: row.customerStatus === "deleted" ? "deleted" : "active",
    } satisfies TenantMemberListItem;
  }

  async resolveTenantMember(scope: TenantScope, memberId: string) {
    const [member] = await this.db
      .select(this.memberProjection())
      .from(restaurantCustomers)
      .innerJoin(customers, eq(restaurantCustomers.customerId, customers.id))
      .leftJoin(
        customerPreferences,
        eq(customerPreferences.customerId, customers.id),
      )
      .where(
        and(
          eq(restaurantCustomers.restaurantId, scope.restaurantId),
          eq(restaurantCustomers.id, memberId),
        ),
      )
      .limit(1);
    return member ?? null;
  }

  async get(scope: TenantScope, memberId: string) {
    return this.toPublicMember(await this.resolveTenantMember(scope, memberId));
  }

  async list(
    scope: TenantScope,
    filters: MemberListFilters,
  ): Promise<MemberListResult> {
    const conditions = [
      eq(restaurantCustomers.restaurantId, scope.restaurantId),
    ];
    if (filters.minOrders != null)
      conditions.push(gte(restaurantCustomers.orderCount, filters.minOrders));
    if (filters.minSpentCents != null)
      conditions.push(
        gte(restaurantCustomers.totalSpentCents, filters.minSpentCents),
      );
    if (filters.lastOrderFrom)
      conditions.push(
        gte(restaurantCustomers.lastOrderAt, filters.lastOrderFrom),
      );
    if (filters.lastOrderTo)
      conditions.push(
        lte(restaurantCustomers.lastOrderAt, filters.lastOrderTo),
      );
    if (filters.blocked != null)
      conditions.push(
        eq(restaurantCustomers.isBlocked, filters.blocked ? 1 : 0),
      );
    if (filters.search?.trim()) {
      const search = filters.search.trim();
      // PII may only be compared as a complete value, never partial LIKE.
      conditions.push(
        or(
          like(customers.displayName, `%${search}%`),
          eq(customers.primaryPhone, search),
          eq(customers.primaryEmail, search.toLowerCase()),
        )!,
      );
    }

    const where = and(...conditions);
    const orderBy =
      filters.sort === "spent"
        ? desc(restaurantCustomers.totalSpentCents)
        : filters.sort === "orders"
          ? desc(restaurantCustomers.orderCount)
          : filters.sort === "name"
            ? asc(customers.displayName)
            : desc(restaurantCustomers.lastOrderAt);
    const offset = (filters.page - 1) * filters.limit;
    const [rows, totalRows] = await Promise.all([
      this.db
        .select(this.memberProjection())
        .from(restaurantCustomers)
        .innerJoin(customers, eq(restaurantCustomers.customerId, customers.id))
        .leftJoin(
          customerPreferences,
          eq(customerPreferences.customerId, customers.id),
        )
        .where(where)
        .orderBy(orderBy)
        .limit(filters.limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(restaurantCustomers)
        .innerJoin(customers, eq(restaurantCustomers.customerId, customers.id))
        .where(where),
    ]);
    const total = totalRows[0]?.total ?? 0;
    return {
      members: rows.map((row) => this.toPublicMember(row)!),
      total,
      page: filters.page,
      limit: filters.limit,
      pages: Math.max(1, Math.ceil(total / filters.limit)),
    };
  }

  async stats(scope: TenantScope) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [row] = await this.db
      .select({
        totalMembers: count(),
        newThisMonth: sql<number>`sum(case when ${restaurantCustomers.firstOrderAt} >= ${monthStart} then 1 else 0 end)`,
        repeatMembers: sql<number>`sum(case when ${restaurantCustomers.orderCount} >= 2 then 1 else 0 end)`,
        totalSpent: sql<number>`coalesce(sum(${restaurantCustomers.totalSpentCents}), 0)`,
        totalOrders: sql<number>`coalesce(sum(${restaurantCustomers.orderCount}), 0)`,
      })
      .from(restaurantCustomers)
      .where(eq(restaurantCustomers.restaurantId, scope.restaurantId));
    const totalMembers = row?.totalMembers ?? 0;
    const totalOrders = row?.totalOrders ?? 0;
    return {
      totalMembers,
      newThisMonth: row?.newThisMonth ?? 0,
      repeatRate:
        totalMembers === 0 ? 0 : (row?.repeatMembers ?? 0) / totalMembers,
      avgOrderValueCents:
        totalOrders === 0
          ? 0
          : Math.round((row?.totalSpent ?? 0) / totalOrders),
    };
  }

  /** Rebuild one projection from order facts; safe to retry after any write. */
  async recomputeForCustomer(scope: TenantScope, customerId: string) {
    const [rollup] = await this.db
      .select({
        orderCount: sql<number>`sum(case when ${orders.status} != 'cancelled' then 1 else 0 end)`,
        cancelledOrderCount: sql<number>`sum(case when ${orders.status} = 'cancelled' then 1 else 0 end)`,
        totalSpentCents: sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' then coalesce(${orders.totalAmountCents}, 0) else 0 end), 0)`,
        firstOrderAt: sql<
          number | null
        >`min(case when ${orders.status} != 'cancelled' then ${orders.createdAt} end)`,
        lastOrderAt: sql<
          number | null
        >`max(case when ${orders.status} != 'cancelled' then ${orders.createdAt} end)`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.restaurantId, scope.restaurantId),
          eq(orders.customerId, customerId),
        ),
      );

    if (!rollup || !rollup.orderCount) {
      await this.db
        .delete(restaurantCustomers)
        .where(
          and(
            eq(restaurantCustomers.restaurantId, scope.restaurantId),
            eq(restaurantCustomers.customerId, customerId),
          ),
        );
      return;
    }

    const now = new Date();
    const firstOrderAt =
      rollup.firstOrderAt == null ? null : new Date(rollup.firstOrderAt);
    const lastOrderAt =
      rollup.lastOrderAt == null ? null : new Date(rollup.lastOrderAt);
    await this.db
      .insert(restaurantCustomers)
      .values({
        restaurantId: scope.restaurantId,
        customerId,
        orderCount: rollup.orderCount,
        cancelledOrderCount: rollup.cancelledOrderCount ?? 0,
        totalSpentCents: rollup.totalSpentCents ?? 0,
        firstOrderAt,
        lastOrderAt,
        recomputedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          restaurantCustomers.restaurantId,
          restaurantCustomers.customerId,
        ],
        set: {
          orderCount: rollup.orderCount,
          cancelledOrderCount: rollup.cancelledOrderCount ?? 0,
          totalSpentCents: rollup.totalSpentCents ?? 0,
          firstOrderAt,
          lastOrderAt,
          recomputedAt: now,
          updatedAt: now,
        },
      });
  }

  async listOrders(
    scope: TenantScope,
    memberId: string,
    page: number,
    limit: number,
  ) {
    const member = await this.resolveTenantMember(scope, memberId);
    if (!member) return null;
    const [rows, totalRows] = await Promise.all([
      this.db
        .select({
          orderId: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          totalAmountCents: orders.totalAmountCents,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, scope.restaurantId),
            eq(orders.customerId, member.customerId),
          ),
        )
        .orderBy(desc(orders.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ total: count() })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, scope.restaurantId),
            eq(orders.customerId, member.customerId),
          ),
        ),
    ]);
    const total = totalRows[0]?.total ?? 0;
    return {
      orders: rows,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }
}
