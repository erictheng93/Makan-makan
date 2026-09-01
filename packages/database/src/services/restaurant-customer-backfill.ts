import { sql, type Column, type SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { customers, orders, restaurantCustomers, restaurants } from "../schema";

/**
 * One-off backfill of `restaurant_customers` from historical order facts
 * (issue #299, spec §6.2).
 *
 * Deliberately NOT a migration. The row count is unknown, the work has to be
 * resumable and re-runnable, and a migration is none of those things: it runs
 * once, unbatched, inside the deploy. `scripts/backfill-restaurant-customers.ts`
 * drives this in batches instead.
 *
 * Written as a Drizzle Layer 2 fragment rather than a raw SQL string (CLAUDE.md
 * bans Layer 3 in new code) so a schema rename breaks the build here instead of
 * silently backfilling nothing at 3am. Column *names* still have to be spliced
 * in raw for the INSERT column list — interpolating a Column renders it
 * qualified (`"t"."c"`), which is not valid there — but they are read off the
 * schema objects, so they track a rename too.
 */

const rc = restaurantCustomers;

/** The unqualified SQL name of a column, for an INSERT column list. */
function name(column: Column): SQL {
  return sql.raw(column.name);
}

/**
 * The rollup must agree, term for term, with
 * `TenantMemberDirectoryService.recomputeForCustomer`: order_count counts
 * non-cancelled orders, cancelled_order_count counts cancelled ones,
 * total_spent_cents sums only non-cancelled amounts, first/last are the min and
 * max non-cancelled `created_at_ms`, and a customer whose orders were all
 * cancelled gets no row at all (the HAVING). Any drift between the two makes a
 * backfilled tenant read differently from a live one until the next recompute.
 *
 * `limit` bounds one batch. Each batch skips pairs that already have a row, so
 * running it repeatedly converges and a run interrupted halfway resumes where
 * it stopped.
 */
export function buildRestaurantCustomerBackfillQuery(limit: number): SQL {
  const batchLimit = Math.max(1, Math.trunc(limit));
  return sql`
    insert into ${rc} (
      ${name(rc.id)},
      ${name(rc.restaurantId)},
      ${name(rc.customerId)},
      ${name(rc.orderCount)},
      ${name(rc.cancelledOrderCount)},
      ${name(rc.totalSpentCents)},
      ${name(rc.firstOrderAt)},
      ${name(rc.lastOrderAt)},
      ${name(rc.recomputedAt)},
      ${name(rc.createdAt)},
      ${name(rc.updatedAt)}
    )
    select
      -- Random, not UUID v7. SQLite cannot generate a v7, and these ids are
      -- opaque tenant-scoped handles whose only requirement is uniqueness --
      -- nothing sorts or time-ranges them. The v7 rule governs runtime inserts,
      -- which go through the schema's $defaultFn.
      lower(hex(randomblob(16))),
      ${orders.restaurantId},
      ${orders.customerId},
      sum(case when ${orders.status} != 'cancelled' then 1 else 0 end),
      sum(case when ${orders.status} = 'cancelled' then 1 else 0 end),
      coalesce(sum(case when ${orders.status} != 'cancelled' then coalesce(${orders.totalAmountCents}, 0) else 0 end), 0),
      min(case when ${orders.status} != 'cancelled' then ${orders.createdAt} end),
      max(case when ${orders.status} != 'cancelled' then ${orders.createdAt} end),
      unixepoch('now') * 1000,
      unixepoch('now') * 1000,
      unixepoch('now') * 1000
    from ${orders}
    where ${orders.customerId} is not null
      -- Both foreign keys are enforced, and restaurant_id additionally by a
      -- BEFORE INSERT trigger. A single orphaned order row would otherwise
      -- abort the whole batch, so orphans are skipped rather than trusted.
      and exists (
        select 1 from ${customers} where ${customers.id} = ${orders.customerId}
      )
      and exists (
        select 1 from ${restaurants} where ${restaurants.id} = ${orders.restaurantId}
      )
      -- Never overwrite a projection the runtime already recomputed, and make
      -- each batch pick up where the last one stopped.
      and not exists (
        select 1 from ${rc}
        where ${rc.restaurantId} = ${orders.restaurantId}
          and ${rc.customerId} = ${orders.customerId}
      )
    group by ${orders.restaurantId}, ${orders.customerId}
    having sum(case when ${orders.status} != 'cancelled' then 1 else 0 end) > 0
    limit ${sql.raw(String(batchLimit))}
    -- Belt and braces over the NOT EXISTS above: a live recompute can insert
    -- the same pair between this statement's scan and its write.
    on conflict (${name(rc.restaurantId)}, ${name(rc.customerId)}) do nothing
  `;
}

/**
 * How much history the backfill has to walk. Spec §6.2 asks for this to be
 * measured before the first production run, so the script reports it rather
 * than assuming the table is small.
 */
export function buildBackfillCandidateOrderCountQuery(): SQL {
  return sql`select count(*) as total from ${orders} where ${orders.customerId} is not null`;
}

/** Pairs still missing a projection row — the work actually remaining. */
export function buildBackfillPendingPairCountQuery(): SQL {
  return sql`
    select count(*) as total from (
      select 1
      from ${orders}
      where ${orders.customerId} is not null
        and not exists (
          select 1 from ${rc}
          where ${rc.restaurantId} = ${orders.restaurantId}
            and ${rc.customerId} = ${orders.customerId}
        )
      group by ${orders.restaurantId}, ${orders.customerId}
      having sum(case when ${orders.status} != 'cancelled' then 1 else 0 end) > 0
    )
  `;
}

/**
 * The same statements as plain text, for the CLI in
 * `scripts/backfill-restaurant-customers.ts`. That script drives a D1 only
 * wrangler can reach, and `wrangler d1 execute --command` binds no parameters —
 * so rendering happens here, where the dialect already lives, and the
 * zero-parameter property is asserted rather than assumed.
 */
function renderStatement(fragment: SQL): string {
  const query = new SQLiteSyncDialect().sqlToQuery(fragment);
  if (query.params.length > 0) {
    throw new Error(
      `Backfill SQL carries ${query.params.length} bound parameter(s); wrangler d1 execute cannot bind them.`,
    );
  }
  return query.sql;
}

export function restaurantCustomerBackfillStatement(limit: number): string {
  return renderStatement(buildRestaurantCustomerBackfillQuery(limit));
}

export function backfillCandidateOrderCountStatement(): string {
  return renderStatement(buildBackfillCandidateOrderCountQuery());
}

export function backfillPendingPairCountStatement(): string {
  return renderStatement(buildBackfillPendingPairCountQuery());
}
