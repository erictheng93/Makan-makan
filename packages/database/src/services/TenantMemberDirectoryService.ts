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
import type { CustomerConsentType } from "@makanmasak/shared-types";
import { normalizeE164Phone } from "@makanmasak/utils";
import {
  AUDIT_ACTIONS,
  auditLogs,
  customerConsents,
  customerPreferences,
  customers,
  orders,
  restaurantCustomers,
} from "../schema";
import { BaseService } from "./base";
import { maskEmail, maskPhone } from "./pii-masking";

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
  // Null for a soft-deleted customer. The API is a 6-locale product, so the
  // placeholder copy belongs to the client, which already receives
  // `status: "deleted"` to render it from.
  displayName: string | null;
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

export interface TenantMemberContact {
  memberId: string;
  phone: string | null;
  email: string | null;
}

/** Who is asking, for the audit trail a reveal is required to leave behind. */
export interface AuditActor {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * A reveal has three outcomes and the caller must be able to tell them apart:
 * a member outside the scope is `not-found` (never `forbidden`, which would
 * make the endpoint an existence oracle for another tenant's directory), while
 * a soft-deleted customer inside the scope is `forbidden` per spec §9.4.
 */
export type MemberContactRevealOutcome =
  | { outcome: "revealed"; contact: TenantMemberContact }
  | { outcome: "not-found" }
  | { outcome: "deleted" };

/**
 * The only consent that gates a marketing send. The version catalog lives in
 * `@makanmasak/shared-types`; nothing here compares a version string, because
 * "which version is current" is not this projection's question to answer.
 */
const MARKETING_CONSENT: CustomerConsentType = "marketing";

/**
 * Whether a search term is worth normalising as a phone number. Deliberately
 * loose — a miss just means one fewer OR term, never a wider match — but it
 * keeps a name search from being normalised into a bare "+" and compared
 * against stored numbers.
 */
const LOOKS_LIKE_PHONE = /^\+?[\d\s\-().]{6,}$/;

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
      // Consent is an append-only ledger, so a customer has many rows per type
      // and a join would multiply the page. A correlated EXISTS keeps one row
      // per member and rides customer_consents_customer_type_revoked_idx.
      marketingConsented: sql<number>`exists (
        select 1 from ${customerConsents}
        where ${customerConsents.customerId} = ${customers.id}
          and ${customerConsents.consentType} = ${MARKETING_CONSENT}
          and ${customerConsents.granted} = 1
          and ${customerConsents.revokedAt} is null
      )`,
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
      // No display copy crosses the API boundary; `status` is what the client
      // renders its own localised placeholder from.
      displayName: row.customerStatus === "deleted" ? null : row.displayName,
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
      // Both halves are required (spec §9.3): the preference flag says what the
      // customer chose in the app, the consent ledger says whether that choice
      // is still legally live. A revoked consent with a stale opt-in flag must
      // read as unreachable, not reachable.
      marketingReachable:
        row.customerStatus === "active" &&
        Boolean(row.marketingOptIn) &&
        Boolean(row.marketingConsented),
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

  /**
   * Unmasked contact for one member, still addressed only by member id.
   *
   * The audit row is written here rather than by the caller, and the disclosure
   * is returned only if that write succeeded. Splitting the two would leave a
   * read any second call site could reuse without auditing; keeping them in one
   * method means there is no unaudited way to obtain the value.
   *
   * The failure policy is the *opposite* of
   * `OrderService.recomputeMemberProjection`, which logs and continues. There
   * the order is already committed and a lost projection is repaired by the
   * next recompute, so failing would turn a durable write into a spurious
   * retry. Here the disclosure is the thing being audited and nothing can
   * reconstruct it afterwards, so an audit failure must propagate and the
   * caller must not receive the contact details.
   */
  async revealContact(
    scope: TenantScope,
    memberId: string,
    actor: AuditActor,
    /**
     * Optional operator justification. The spec's flow asks for a confirmation
     * modal rather than typed text, so the endpoint does not require one — but
     * when a client sends it, it is worth keeping next to the disclosure.
     */
    reason?: string,
  ): Promise<MemberContactRevealOutcome> {
    const row = await this.resolveTenantMember(scope, memberId);
    if (!row) return { outcome: "not-found" };

    // A soft-deleted customer keeps their membership row (the order facts are
    // still the tenant's) but their PII is no longer disclosable. The refusal
    // is audited too: an attempt on deleted data is exactly what a later
    // investigation would want to see.
    const deleted = row.customerStatus === "deleted";

    await this.writeRevealAudit(scope, row.memberId, actor, !deleted, reason);
    if (deleted) return { outcome: "deleted" };

    return {
      outcome: "revealed",
      contact: {
        memberId: row.memberId,
        phone: row.phone,
        email: row.email,
      },
    };
  }

  /**
   * Records that a disclosure happened — never a second copy of what was
   * disclosed. `resourceId` is the tenant-scoped member id, so the platform
   * `customers.id` does not leak into the audit trail either.
   */
  private async writeRevealAudit(
    scope: TenantScope,
    memberId: string,
    actor: AuditActor,
    success: boolean,
    reason?: string,
  ) {
    await this.db.insert(auditLogs).values({
      userId: actor.userId,
      restaurantId: scope.restaurantId,
      action: AUDIT_ACTIONS.CUSTOMER_PII_REVEAL,
      resource: "restaurant_customers",
      resourceId: memberId,
      description: success
        ? `Revealed contact details for member ${memberId}`
        : `Refused contact reveal for deleted member ${memberId}`,
      changes: {
        metadata: reason
          ? { fields: ["phone", "email"], reason }
          : { fields: ["phone", "email"] },
      },
      ipAddress: actor.ipAddress ?? null,
      userAgent: actor.userAgent ?? null,
      success,
      errorMessage: success ? null : "CUSTOMER_DELETED",
    });
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
      // PII may only be compared as a complete value, never a partial LIKE.
      // A prefix match would turn this endpoint into an enumeration tool —
      // typing "0912" would return every customer whose number starts with it.
      // Equality leaks nothing extra, because the operator has to already know
      // the whole value to find anyone with it.
      const terms = [like(customers.displayName, `%${search}%`)];
      if (LOOKS_LIKE_PHONE.test(search)) {
        // The list shows a phone in its local dial form ("0912***678"), so that
        // is the form an owner types back in. Comparing it raw against the
        // stored E.164 misses by a country code every time.
        terms.push(eq(customers.primaryPhone, normalizeE164Phone(search)));
      }
      if (search.includes("@")) {
        terms.push(eq(customers.primaryEmail, search.toLowerCase()));
      }
      conditions.push(or(...terms)!);
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
    // Business months follow the +8 convention of utils/sql-time.ts, not the
    // server's local clock: `new Date().setDate(1)` puts UTC CI and a Taipei
    // box in different months for eight hours of every day, and would silently
    // move the boundary again the moment the Worker's TZ changed.
    //
    // Computing it in SQL also sidesteps binding a JS Date into a raw sql``
    // fragment, where there is no column encoder in scope to turn it into ms.
    const businessMonthStartMs = sql`(unixepoch(strftime('%Y-%m-01', 'now', '+8 hours')) - 8 * 3600) * 1000`;
    const [row] = await this.db
      .select({
        totalMembers: count(),
        newThisMonth: sql<number>`sum(case when ${restaurantCustomers.firstOrderAt} >= ${businessMonthStartMs} then 1 else 0 end)`,
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
