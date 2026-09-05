import {
  and,
  asc,
  type Column,
  count,
  desc,
  eq,
  gte,
  like,
  lte,
  or,
  type SQL,
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
import { BusinessTimezoneResolver } from "../utils/business-timezone";
import { strftimeNow } from "../utils/sql-time";
import { maskEmail, maskPhone } from "./pii-masking";

export interface TenantScope {
  readonly restaurantId: string;
}

export interface MemberListFilters {
  page: number;
  limit: number;
  search?: string;
  tag?: string;
  minOrders?: number;
  /**
   * Upper bound on `order_count`, inclusive. Exists so the UI can ask for
   * "first-time customers" (`maxOrders: 1`) — a range the min-only filter set
   * could not express at all.
   */
  maxOrders?: number;
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
  note: string | null;
  isBlocked: boolean;
  blockedReason: string | null;
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
 * Every field optional; the route's zod schema is what enforces "at least
 * one field present" before this ever runs. `undefined` means "leave this
 * column alone"; `null` (where the field allows it) means "clear it".
 */
export interface MemberPatch {
  tags?: string[] | null;
  note?: string | null;
  isBlocked?: boolean;
  blockedReason?: string | null;
}

/**
 * Same not-found shape as the reveal flow, and for the same reason: another
 * tenant's member must read as "does not exist", never as "exists but you
 * can't touch it".
 */
export type MemberUpdateOutcome =
  | { outcome: "updated"; member: TenantMemberListItem }
  | { outcome: "not-found" };

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
 * The rollup terms, defined once. `recomputeForCustomer` selects them for a
 * single customer; `recomputeAll` splices the same fragments into a set-based
 * INSERT ... SELECT. Keeping one definition is what stops the two from
 * drifting -- `restaurant-customer-backfill.ts` carries a third copy for the
 * CLI and says the same thing about why they must agree term for term.
 */
const ROLLUP = {
  orderCount: sql<number>`sum(case when ${orders.status} != 'cancelled' then 1 else 0 end)`,
  cancelledOrderCount: sql<number>`sum(case when ${orders.status} = 'cancelled' then 1 else 0 end)`,
  totalSpentCents: sql<number>`coalesce(sum(case when ${orders.status} != 'cancelled' then coalesce(${orders.totalAmountCents}, 0) else 0 end), 0)`,
  firstOrderAt: sql<
    number | null
  >`min(case when ${orders.status} != 'cancelled' then ${orders.createdAt} end)`,
  lastOrderAt: sql<
    number | null
  >`max(case when ${orders.status} != 'cancelled' then ${orders.createdAt} end)`,
} as const;

/**
 * The unqualified SQL name of a column, for an INSERT column list -- splicing
 * the Column itself renders it qualified (`"t"."c"`), which is not valid
 * there. Read off the schema object so a rename still tracks.
 */
function columnName(column: Column): SQL {
  return sql.raw(column.name);
}

/**
 * One export is a single unpaginated query, so it needs a ceiling. 5,000 rows
 * is far above any directory this product has today and still small enough to
 * serialize inside a Worker's memory and CPU budget. A tenant at the cap gets
 * a truncated file rather than a failed one, and the response says so -- a
 * silent truncation of a reconciliation export is worse than a visible one.
 */
export const MEMBER_EXPORT_MAX_ROWS = 5000;

export interface MemberExportResult {
  members: TenantMemberListItem[];
  /** Rows matching the filter, which may exceed what the file contains. */
  total: number;
  truncated: boolean;
}

export interface MemberRecomputeResult {
  /** Member rows this restaurant holds once the recompute settled. */
  members: number;
  /** Rows dropped because no live order justifies them any more. */
  removed: number;
}

/**
 * Read-only tenant projection for member administration. No method accepts a
 * customer id; callers can only address a member through restaurant_customers.
 */
export class TenantMemberDirectoryService extends BaseService {
  private readonly businessTimezone = new BusinessTimezoneResolver(this.db);

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
      note: restaurantCustomers.note,
      isBlocked: restaurantCustomers.isBlocked,
      blockedReason: restaurantCustomers.blockedReason,
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
      note: row.note,
      isBlocked: Boolean(row.isBlocked),
      blockedReason: row.blockedReason,
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

  /**
   * Tenant-local marker fields only (spec §7.1 D-4): tags, note, and the
   * block marker. Never touches `customers` or any other tenant's row, and
   * never accepts a `customers` column in the first place — the route's zod
   * schema is `.strict()`, so an unknown key 400s before it ever reaches
   * here.
   *
   * `isBlocked` is a MARKER ONLY, by design (spec Q-2). It is not checked by
   * order creation, reservations, or coupons, and it must not become one:
   * a guest order carries no `customer_id` at all, so a blocked member can
   * always place one as a guest, and a check that only sometimes fires is
   * worse than no check — staff would come to trust a gate that doesn't
   * gate. If enforcement is ever wanted, it needs its own design for how a
   * guest checkout is supposed to recognise a blocked person, which today it
   * structurally cannot.
   *
   * Audit decision (issue #299 A3): only an actual `isBlocked` transition
   * writes an audit row; tag and note edits do not. Block/unblock changes
   * how staff treat a member and is exactly the kind of action that gets
   * disputed later ("who blocked this customer, and why"), so it needs a
   * paper trail. A tag or note edit is ordinary CRM housekeeping — an owner
   * re-tags and re-words notes routinely, and an audit log padded with
   * "changed note from X to Y" a dozen times a day would bury the one entry
   * that actually matters. Re-sending `isBlocked: true` on an already
   * blocked member (no state change) does not write a second row either;
   * only the flip is the auditable event.
   */
  async update(
    scope: TenantScope,
    memberId: string,
    patch: MemberPatch,
    actor: AuditActor,
  ): Promise<MemberUpdateOutcome> {
    const current = await this.resolveTenantMember(scope, memberId);
    if (!current) return { outcome: "not-found" };

    const wasBlocked = Boolean(current.isBlocked);
    const isBlocked = patch.isBlocked ?? wasBlocked;
    // Whatever reason accompanied a block does not survive an unblock: a
    // stale reason on an unblocked member reads as evidence for a block that
    // no longer exists.
    const blockedReason = !isBlocked
      ? null
      : patch.blockedReason !== undefined
        ? patch.blockedReason
        : current.blockedReason;
    const tags = patch.tags !== undefined ? patch.tags : current.tags;
    const note = patch.note !== undefined ? patch.note : current.note;

    // The restaurant predicate here is deliberately redundant: `memberId` is
    // already a primary key and `resolveTenantMember` above refused anything
    // outside the scope, so no request reaches this statement with a foreign
    // member. It is defence in depth against a future caller that skips the
    // resolve step -- and, precisely because it is unreachable, NO TEST CAN
    // COVER IT. Mutating it away leaves the suite green (verified 2026-09-02),
    // so do not read that green as permission to simplify this WHERE; the
    // guard the tests actually pin is the one in `resolveTenantMember`.
    await this.db
      .update(restaurantCustomers)
      .set({
        tags,
        note,
        isBlocked: isBlocked ? 1 : 0,
        blockedReason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(restaurantCustomers.restaurantId, scope.restaurantId),
          eq(restaurantCustomers.id, memberId),
        ),
      );

    if (patch.isBlocked !== undefined && isBlocked !== wasBlocked) {
      await this.writeBlockStatusAudit(
        scope,
        memberId,
        actor,
        wasBlocked,
        isBlocked,
        blockedReason,
      );
    }

    const updated = await this.resolveTenantMember(scope, memberId);
    return { outcome: "updated", member: this.toPublicMember(updated)! };
  }

  /**
   * Records the block/unblock transition and the reason that came with it —
   * never a second copy of the member's PII. `resourceId` is the
   * tenant-scoped member id, same discipline as `writeRevealAudit`.
   */
  private async writeBlockStatusAudit(
    scope: TenantScope,
    memberId: string,
    actor: AuditActor,
    from: boolean,
    to: boolean,
    blockedReason: string | null,
  ) {
    await this.db.insert(auditLogs).values({
      userId: actor.userId,
      restaurantId: scope.restaurantId,
      action: AUDIT_ACTIONS.MEMBER_BLOCK_STATUS_CHANGE,
      resource: "restaurant_customers",
      resourceId: memberId,
      description: to
        ? `Blocked member ${memberId}`
        : `Unblocked member ${memberId}`,
      changes: {
        metadata: { from, to, blockedReason },
      },
      ipAddress: actor.ipAddress ?? null,
      userAgent: actor.userAgent ?? null,
      success: true,
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
    if (filters.maxOrders != null)
      conditions.push(lte(restaurantCustomers.orderCount, filters.maxOrders));
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
    if (filters.tag) {
      // `tags` is a JSON array column, so a LIKE/substring test would let
      // "vip" match a member tagged only "vip-lapsed". json_each expands the
      // array so the comparison is against one exact element at a time.
      // Guard the NULL case explicitly rather than relying on json_each's
      // behaviour against a NULL argument.
      conditions.push(
        sql`${restaurantCustomers.tags} is not null and exists (
          select 1 from json_each(${restaurantCustomers.tags})
          where value = ${filters.tag}
        )`,
      );
    }
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
    // Business months follow this restaurant's own midnight (#329), not the
    // server's local clock: `new Date().setDate(1)` puts UTC CI and a Taipei
    // box in different months for eight hours of every day, and would silently
    // move the boundary again the moment the Worker's TZ changed.
    //
    // Computing it in SQL also sidesteps binding a JS Date into a raw sql``
    // fragment, where there is no column encoder in scope to turn it into ms.
    // strftime gives the shop's local first-of-month; subtracting the offset
    // turns that wall clock back into the UTC instant the column stores.
    const offsetMinutes = await this.businessTimezone.offsetMinutes(
      scope.restaurantId,
    );
    const businessMonthStartMs = sql`(unixepoch(${strftimeNow("%Y-%m-01", offsetMinutes)}) - ${offsetMinutes * 60}) * 1000`;
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

  /**
   * Bulk read of the directory for a CSV export (spec §7.1).
   *
   * **Masked only.** The rows are exactly what `list()` returns, so a phone
   * still leaves as `0912***678`. A full-PII export is Q-3 in the spec and is
   * deliberately not implemented here: an unmasked file lands on a laptop and
   * outlives every control this codebase has, and nothing in the reconciliation
   * use case needs one.
   *
   * The audit row is written here rather than by the caller, and the rows are
   * returned only if that write succeeded -- the same discipline, and the same
   * reason, as `revealContact`. A bulk read of the directory is exactly the
   * event an investigation would look for, and splitting the two would leave a
   * read a second call site could reuse without auditing.
   */
  async exportMembers(
    scope: TenantScope,
    filters: Omit<MemberListFilters, "page" | "limit">,
    actor: AuditActor,
  ): Promise<MemberExportResult> {
    const result = await this.list(scope, {
      ...filters,
      page: 1,
      limit: MEMBER_EXPORT_MAX_ROWS,
    });
    const truncated = result.total > result.members.length;
    await this.writeExportAudit(
      scope,
      actor,
      result.members.length,
      result.total,
      truncated,
    );
    return { members: result.members, total: result.total, truncated };
  }

  /**
   * Records that a bulk read happened, how much of the directory it covered,
   * and nothing that was in it. No member ids, no names, no contact values --
   * an audit row that copies the export would be a second, unmasked copy of
   * the thing being audited.
   */
  private async writeExportAudit(
    scope: TenantScope,
    actor: AuditActor,
    exported: number,
    matched: number,
    truncated: boolean,
  ) {
    await this.db.insert(auditLogs).values({
      userId: actor.userId,
      restaurantId: scope.restaurantId,
      action: AUDIT_ACTIONS.CUSTOMER_DATA_EXPORT,
      resource: "restaurant_customers",
      resourceId: scope.restaurantId,
      description: `Exported ${exported} member rows (masked)`,
      changes: { metadata: { exported, matched, truncated, masked: true } },
      ipAddress: actor.ipAddress ?? null,
      userAgent: actor.userAgent ?? null,
      success: true,
    });
  }

  /**
   * Rebuild every projection this restaurant holds, from order facts (spec
   * §7.1 `POST /members/recompute`). For reconciliation: the live path
   * recomputes one member per order event, so a projection can only be wrong
   * if one of those recomputes was lost, and nothing else repairs it.
   *
   * Set-based on purpose. The obvious implementation -- read the distinct
   * customer ids and call `recomputeForCustomer` for each -- issues one D1
   * query per member, which walks straight into the Worker subrequest limit
   * for any tenant with a real directory. Two statements have no such ceiling.
   *
   * The delete is the same policy `recomputeForCustomer` already applies when
   * a customer's last live order goes away: no live order, no membership row.
   * That does discard the tenant's own tags and note for that member, but the
   * live cancel path has always done so, and a reconciliation that left rows
   * the live path would have removed would not be reconciling anything.
   */
  async recomputeAll(scope: TenantScope): Promise<MemberRecomputeResult> {
    const rc = restaurantCustomers;
    const nowMs = sql`unixepoch('now') * 1000`;

    await this.db.run(sql`
      insert into ${rc} (
        ${columnName(rc.id)},
        ${columnName(rc.restaurantId)},
        ${columnName(rc.customerId)},
        ${columnName(rc.orderCount)},
        ${columnName(rc.cancelledOrderCount)},
        ${columnName(rc.totalSpentCents)},
        ${columnName(rc.firstOrderAt)},
        ${columnName(rc.lastOrderAt)},
        ${columnName(rc.recomputedAt)},
        ${columnName(rc.createdAt)},
        ${columnName(rc.updatedAt)}
      )
      select
        -- Only ever used for a row this statement is inserting; an existing
        -- row keeps its own id through the DO UPDATE below, so a member's
        -- identifier survives a recompute. Random rather than UUID v7 for the
        -- reason the backfill gives: SQLite cannot generate a v7, and nothing
        -- sorts or time-ranges these handles.
        lower(hex(randomblob(16))),
        ${orders.restaurantId},
        ${orders.customerId},
        ${ROLLUP.orderCount},
        ${ROLLUP.cancelledOrderCount},
        ${ROLLUP.totalSpentCents},
        ${ROLLUP.firstOrderAt},
        ${ROLLUP.lastOrderAt},
        ${nowMs},
        ${nowMs},
        ${nowMs}
      from ${orders}
      where ${orders.restaurantId} = ${scope.restaurantId}
        and ${orders.customerId} is not null
        -- An orphaned order would abort the whole statement on the foreign key
        -- (and on the restaurant guard trigger), taking the reconciliation of
        -- every other member with it.
        and exists (
          select 1 from ${customers} where ${customers.id} = ${orders.customerId}
        )
      group by ${orders.customerId}
      having ${ROLLUP.orderCount} > 0
      on conflict (${columnName(rc.restaurantId)}, ${columnName(rc.customerId)})
      do update set
        ${columnName(rc.orderCount)} = excluded.${columnName(rc.orderCount)},
        ${columnName(rc.cancelledOrderCount)} = excluded.${columnName(rc.cancelledOrderCount)},
        ${columnName(rc.totalSpentCents)} = excluded.${columnName(rc.totalSpentCents)},
        ${columnName(rc.firstOrderAt)} = excluded.${columnName(rc.firstOrderAt)},
        ${columnName(rc.lastOrderAt)} = excluded.${columnName(rc.lastOrderAt)},
        ${columnName(rc.recomputedAt)} = excluded.${columnName(rc.recomputedAt)},
        ${columnName(rc.updatedAt)} = excluded.${columnName(rc.updatedAt)}
    `);

    const stale = and(
      eq(rc.restaurantId, scope.restaurantId),
      sql`not exists (
        select 1 from ${orders}
        where ${orders.restaurantId} = ${rc.restaurantId}
          and ${orders.customerId} = ${rc.customerId}
          and ${orders.status} != 'cancelled'
      )`,
    );
    const [staleRows] = await this.db
      .select({ total: count() })
      .from(rc)
      .where(stale);
    const removed = staleRows?.total ?? 0;
    if (removed > 0) await this.db.delete(rc).where(stale);

    const [remaining] = await this.db
      .select({ total: count() })
      .from(rc)
      .where(eq(rc.restaurantId, scope.restaurantId));

    return { members: remaining?.total ?? 0, removed };
  }

  /** Rebuild one projection from order facts; safe to retry after any write. */
  async recomputeForCustomer(scope: TenantScope, customerId: string) {
    const [rollup] = await this.db
      .select(ROLLUP)
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
