import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { cashRegisters, restaurants } from "../schema";

/**
 * The timezones a restaurant may keep its books in, with the UTC offset each
 * one resolves to, in minutes.
 *
 * Every entry has a *fixed* offset — none of them observes daylight saving.
 * That is the load-bearing property, not an accident of which markets we
 * happen to serve. SQLite (and therefore D1) knows nothing about IANA names:
 * the only thing `DATE(..., ?)` accepts is a constant modifier such as
 * `'+480 minutes'`. A zone whose offset moves twice a year cannot be expressed
 * that way, so half its year would bucket into the wrong business day with
 * nothing on screen to show for it.
 *
 * `business-timezone.test.ts` re-derives every offset below from ICU at
 * monthly samples across a year. Adding a DST zone here turns that test red
 * instead of shipping a report that is quietly an hour off for six months.
 */
const BUSINESS_TIMEZONE_OFFSET_MINUTES = {
  "Asia/Taipei": 8 * 60,
  "Asia/Kuala_Lumpur": 8 * 60,
  "Asia/Singapore": 8 * 60,
  "Asia/Shanghai": 8 * 60,
  "Asia/Tokyo": 9 * 60,
  "Asia/Ho_Chi_Minh": 7 * 60,
  "Asia/Jakarta": 7 * 60,
} as const satisfies Record<string, number>;

export type BusinessTimezone = keyof typeof BUSINESS_TIMEZONE_OFFSET_MINUTES;

/**
 * Typed as a non-empty tuple so `z.enum` can consume it directly: the API
 * boundary rejects an unsupported zone rather than storing one the SQL layer
 * would silently ignore.
 */
export const SUPPORTED_BUSINESS_TIMEZONES = Object.keys(
  BUSINESS_TIMEZONE_OFFSET_MINUTES,
) as [BusinessTimezone, ...BusinessTimezone[]];

export const DEFAULT_BUSINESS_TIMEZONE: BusinessTimezone = "Asia/Taipei";

export function isBusinessTimezone(value: unknown): value is BusinessTimezone {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(
      BUSINESS_TIMEZONE_OFFSET_MINUTES,
      value,
    )
  );
}

/**
 * Narrow a stored or user-supplied timezone to one this platform can bucket
 * by. Anything unrecognised falls back to the default rather than throwing:
 * a row written by an older build must still produce a report.
 */
export function resolveBusinessTimezone(
  value: string | null | undefined,
): BusinessTimezone {
  return isBusinessTimezone(value) ? value : DEFAULT_BUSINESS_TIMEZONE;
}

export function businessTimezoneOffsetMinutes(
  value: string | null | undefined,
): number {
  return BUSINESS_TIMEZONE_OFFSET_MINUTES[resolveBusinessTimezone(value)];
}

/**
 * The offset for buckets that do not belong to one restaurant's books —
 * platform-wide image and QR counters, for instance. Spelled out at each call
 * site so "this aggregate spans every tenant" reads as a decision rather than
 * as a call site someone forgot to thread a timezone through.
 */
export const PLATFORM_BUSINESS_TIMEZONE_OFFSET_MINUTES =
  BUSINESS_TIMEZONE_OFFSET_MINUTES[DEFAULT_BUSINESS_TIMEZONE];

/**
 * Reads `restaurants.timezone` once per restaurant per instance.
 *
 * A report method runs several queries that must all cut the day at the same
 * instant, and services are constructed per request, so memoising the promise
 * keeps one lookup per report without letting a mid-request timezone change
 * split a single report across two day boundaries.
 */
export class BusinessTimezoneResolver<
  TSchema extends Record<string, unknown> = Record<string, never>,
> {
  private readonly cache = new Map<string, Promise<BusinessTimezone>>();
  private readonly registerOwners = new Map<
    string,
    Promise<string | undefined>
  >();

  constructor(private readonly db: DrizzleD1Database<TSchema>) {}

  async timezone(restaurantId: string): Promise<BusinessTimezone> {
    const cached = this.cache.get(restaurantId);
    if (cached) return cached;

    const pending = this.load(restaurantId);
    this.cache.set(restaurantId, pending);
    return pending;
  }

  async offsetMinutes(restaurantId: string): Promise<number> {
    return businessTimezoneOffsetMinutes(await this.timezone(restaurantId));
  }

  /**
   * The boundary a cash register's takings are booked against.
   *
   * POS reports are addressed by register rather than by restaurant, and a
   * register that no longer resolves to one still has to produce a report
   * rather than an error, so an orphan falls back to the platform offset.
   */
  async offsetMinutesForCashRegister(registerId: string): Promise<number> {
    let owner = this.registerOwners.get(registerId);
    if (!owner) {
      owner = this.loadRegisterOwner(registerId);
      this.registerOwners.set(registerId, owner);
    }

    const restaurantId = await owner;
    return restaurantId === undefined
      ? PLATFORM_BUSINESS_TIMEZONE_OFFSET_MINUTES
      : this.offsetMinutes(restaurantId);
  }

  private async loadRegisterOwner(
    registerId: string,
  ): Promise<string | undefined> {
    const [row] = await this.db
      .select({ restaurantId: cashRegisters.restaurantId })
      .from(cashRegisters)
      .where(eq(cashRegisters.id, registerId))
      .limit(1);

    return row?.restaurantId;
  }

  private async load(restaurantId: string): Promise<BusinessTimezone> {
    const [row] = await this.db
      .select({ timezone: restaurants.timezone })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);

    return resolveBusinessTimezone(row?.timezone);
  }
}
