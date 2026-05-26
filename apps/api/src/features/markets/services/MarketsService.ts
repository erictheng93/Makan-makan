import { drizzle } from "drizzle-orm/d1";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNull,
  like,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { KVNamespace } from "@cloudflare/workers-types";
import {
  marketJoinRequests,
  markets,
  restaurantMarketMemberships,
  restaurants,
} from "@makanmakan/database";
import {
  KVCacheService,
  NoopCacheService,
  type CacheService,
} from "../../../core/cache";
import { CACHE_TTL } from "../../../shared/constants";
import { isOpenNow } from "../../discovery/utils/isOpenNow";
import { boundingBoxFromCircle, distanceKm } from "./geo";

const MARKET_CACHE_VERSION_KEY = "markets:version";

export interface MarketFilters {
  city?: string;
  district?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export interface VendorFilters {
  openNow?: boolean;
  takeaway?: boolean;
  delivery?: boolean;
  q?: string;
  sortBy?: "rating" | "popular";
  page?: number;
  limit?: number;
}

export interface AdminJoinRequestFilters {
  status?: "pending" | "approved" | "rejected";
}

export interface AdminVendorCandidateFilters {
  q?: string;
  marketId?: string;
  limit?: number;
}

export type CreateMarketInput = typeof markets.$inferInsert;
export type UpdateMarketInput = Partial<typeof markets.$inferInsert>;

export class MarketsService {
  private db;
  private cache: CacheService;
  private kv?: KVNamespace;

  constructor(d1: D1Database, kv?: KVNamespace) {
    this.db = drizzle(d1);
    this.kv = kv;
    this.cache = kv ? new KVCacheService(kv) : new NoopCacheService();
  }

  async listMarkets(filters: MarketFilters) {
    const cacheKey = await this.publicCacheKey("list", filters);
    const cached =
      await this.cache.get<Awaited<ReturnType<MarketsService["queryMarkets"]>>>(
        cacheKey,
      );
    if (cached) return cached;

    const data = await this.queryMarkets(filters);
    await this.cache.set(cacheKey, data, CACHE_TTL.SHORT);
    return data;
  }

  private async queryMarkets(filters: MarketFilters) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const conditions = [eq(markets.isActive, true), isNull(markets.deletedAt)];

    if (filters.city) conditions.push(eq(markets.city, filters.city));
    if (filters.district)
      conditions.push(eq(markets.district, filters.district));
    if (filters.type) conditions.push(eq(markets.type, filters.type));

    const whereClause = and(...conditions);
    const rows = await this.db
      .select({
        id: markets.id,
        slug: markets.slug,
        name: markets.name,
        type: markets.type,
        description: markets.description,
        city: markets.city,
        district: markets.district,
        address: markets.address,
        latitude: markets.latitude,
        longitude: markets.longitude,
        openingHours: markets.openingHours,
        bannerUrl: markets.bannerUrl,
        logoUrl: markets.logoUrl,
        imageUrls: markets.imageUrls,
        tags: markets.tags,
        vendorCount: sql<number>`count(${restaurantMarketMemberships.id})`,
      })
      .from(markets)
      .leftJoin(
        restaurantMarketMemberships,
        and(
          eq(restaurantMarketMemberships.marketId, markets.id),
          isNull(restaurantMarketMemberships.leftAt),
        ),
      )
      .where(whereClause)
      .groupBy(markets.id)
      .orderBy(asc(markets.city), asc(markets.district), asc(markets.name))
      .limit(limit)
      .offset(offset);

    const [{ count = 0 } = { count: 0 }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(markets)
      .where(whereClause);

    return {
      markets: rows.map((row) => ({
        ...row,
        vendorCount: Number(row.vendorCount),
      })),
      total: Number(count),
      page,
      limit,
    };
  }

  async getMarketBySlug(slug: string) {
    const cacheKey = await this.publicCacheKey("detail", slug);
    const cached =
      await this.cache.get<
        Awaited<ReturnType<MarketsService["queryMarketBySlug"]>>
      >(cacheKey);
    if (cached) return cached;

    const data = await this.queryMarketBySlug(slug);
    if (data) await this.cache.set(cacheKey, data, CACHE_TTL.SHORT);
    return data;
  }

  private async queryMarketBySlug(slug: string) {
    const [market] = await this.db
      .select()
      .from(markets)
      .where(
        and(
          eq(markets.slug, slug),
          eq(markets.isActive, true),
          isNull(markets.deletedAt),
        ),
      )
      .limit(1);

    if (!market) return null;

    const [{ count = 0 } = { count: 0 }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(restaurantMarketMemberships)
      .where(
        and(
          eq(restaurantMarketMemberships.marketId, market.id),
          isNull(restaurantMarketMemberships.leftAt),
        ),
      );

    return { market, vendorCount: Number(count) };
  }

  async listVendors(slug: string, filters: VendorFilters) {
    const cacheKey = await this.publicCacheKey("vendors", {
      slug,
      ...filters,
    });
    const cached =
      await this.cache.get<Awaited<ReturnType<MarketsService["queryVendors"]>>>(
        cacheKey,
      );
    if (cached) return cached;

    const data = await this.queryVendors(slug, filters);
    if (data) await this.cache.set(cacheKey, data, CACHE_TTL.SHORT);
    return data;
  }

  private async queryVendors(slug: string, filters: VendorFilters) {
    const marketDetail = await this.getMarketBySlug(slug);
    if (!marketDetail) return null;

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const conditions = [
      eq(restaurantMarketMemberships.marketId, marketDetail.market.id),
      isNull(restaurantMarketMemberships.leftAt),
      eq(restaurants.isActive, true),
      isNull(restaurants.deletedAt),
    ];

    if (filters.q) conditions.push(like(restaurants.name, `%${filters.q}%`));
    if (filters.takeaway)
      conditions.push(eq(restaurants.supportsTakeaway, true));
    if (filters.delivery)
      conditions.push(eq(restaurants.supportsDelivery, true));

    const whereClause = and(...conditions);
    const rows = await this.db
      .select({
        restaurantId: restaurants.id,
        name: restaurants.name,
        type: restaurants.type,
        category: restaurants.category,
        district: restaurants.district,
        city: restaurants.city,
        priceRange: restaurants.priceRange,
        rating: restaurants.rating,
        businessHours: restaurants.businessHours,
        supportsTakeaway: restaurants.supportsTakeaway,
        supportsDelivery: restaurants.supportsDelivery,
        imageUrl: restaurants.logoUrl,
        stallNumber: restaurantMarketMemberships.stallNumber,
        isPrimary: restaurantMarketMemberships.isPrimary,
      })
      .from(restaurantMarketMemberships)
      .innerJoin(
        restaurants,
        eq(restaurantMarketMemberships.restaurantId, restaurants.id),
      )
      .where(whereClause)
      .orderBy(
        filters.sortBy === "rating"
          ? desc(restaurants.rating)
          : desc(restaurants.totalOrders),
      )
      .limit(limit)
      .offset(offset);

    let vendors = rows.map((row) => ({
      ...row,
      isOpen: isOpenNow(row.businessHours ?? null),
    }));
    if (filters.openNow) vendors = vendors.filter((row) => row.isOpen);

    const [{ count = 0 } = { count: 0 }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(restaurantMarketMemberships)
      .innerJoin(
        restaurants,
        eq(restaurantMarketMemberships.restaurantId, restaurants.id),
      )
      .where(whereClause);

    return {
      vendors,
      total: filters.openNow ? vendors.length : Number(count),
      page,
      limit,
    };
  }

  async findNearby(lat: number, lng: number, radiusKm = 2, limit = 20) {
    const cacheKey = await this.publicCacheKey("nearby", {
      lat: Number(lat.toFixed(3)),
      lng: Number(lng.toFixed(3)),
      radiusKm,
      limit,
    });
    const cached =
      await this.cache.get<Awaited<ReturnType<MarketsService["queryNearby"]>>>(
        cacheKey,
      );
    if (cached) return cached;

    const data = await this.queryNearby(lat, lng, radiusKm, limit);
    await this.cache.set(cacheKey, data, CACHE_TTL.SHORT);
    return data;
  }

  private async queryNearby(
    lat: number,
    lng: number,
    radiusKm = 2,
    limit = 20,
  ) {
    const cappedRadius = Math.min(Math.max(radiusKm, 0.1), 10);
    const cappedLimit = Math.min(Math.max(limit, 1), 50);
    const box = boundingBoxFromCircle(lat, lng, cappedRadius);
    const rows = await this.db
      .select({
        id: markets.id,
        slug: markets.slug,
        name: markets.name,
        type: markets.type,
        city: markets.city,
        district: markets.district,
        address: markets.address,
        latitude: markets.latitude,
        longitude: markets.longitude,
        openingHours: markets.openingHours,
        bannerUrl: markets.bannerUrl,
        logoUrl: markets.logoUrl,
        imageUrls: markets.imageUrls,
        tags: markets.tags,
      })
      .from(markets)
      .where(
        and(
          eq(markets.isActive, true),
          isNull(markets.deletedAt),
          gte(markets.latitude, box.southLat),
          lte(markets.latitude, box.northLat),
          gte(markets.longitude, box.westLng),
          lte(markets.longitude, box.eastLng),
        ),
      )
      .limit(100);

    const withDistance = rows
      .map((row) => ({
        ...row,
        distanceKm: distanceKm(
          { lat, lng },
          { lat: row.latitude, lng: row.longitude },
        ),
      }))
      .filter((row) => row.distanceKm <= cappedRadius)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, cappedLimit);

    return { markets: withDistance };
  }

  async getMarketById(id: string) {
    const [market] = await this.db
      .select()
      .from(markets)
      .where(eq(markets.id, id))
      .limit(1);
    return market ?? null;
  }

  async createMarket(input: CreateMarketInput) {
    const now = new Date();
    const [market] = await this.db
      .insert(markets)
      .values({
        ...input,
        isActive: input.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await this.bumpPublicCacheVersion();
    return market;
  }

  async updateMarket(id: string, input: UpdateMarketInput) {
    const existing = await this.getMarketById(id);
    if (!existing) return null;

    const [market] = await this.db
      .update(markets)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(markets.id, id))
      .returning();
    if (market) await this.bumpPublicCacheVersion();
    return market ?? null;
  }

  async softDeleteMarket(id: string) {
    const existing = await this.getMarketById(id);
    if (!existing) return false;

    await this.db
      .update(markets)
      .set({
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(markets.id, id));
    await this.bumpPublicCacheVersion();
    return true;
  }

  async addVendor(
    marketId: string,
    input: {
      restaurantId: string;
      stallNumber?: string | null;
      isPrimary?: boolean;
    },
  ) {
    const market = await this.getMarketById(marketId);
    if (!market || market.deletedAt) return null;

    if (input.isPrimary) {
      await this.db
        .update(restaurantMarketMemberships)
        .set({ isPrimary: false })
        .where(
          and(
            eq(restaurantMarketMemberships.restaurantId, input.restaurantId),
            isNull(restaurantMarketMemberships.leftAt),
          ),
        );
    }

    const [membership] = await this.db
      .insert(restaurantMarketMemberships)
      .values({
        marketId,
        restaurantId: input.restaurantId,
        stallNumber: input.stallNumber ?? null,
        isPrimary: input.isPrimary ?? false,
        joinedAt: new Date(),
      })
      .returning();
    await this.bumpPublicCacheVersion();
    return membership;
  }

  async removeVendor(marketId: string, restaurantId: string) {
    const result = await this.db
      .update(restaurantMarketMemberships)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(restaurantMarketMemberships.marketId, marketId),
          eq(restaurantMarketMemberships.restaurantId, restaurantId),
          isNull(restaurantMarketMemberships.leftAt),
        ),
      )
      .returning();
    const removed = result.length > 0;
    if (removed) await this.bumpPublicCacheVersion();
    return removed;
  }

  async listRestaurantMemberships(restaurantId: string) {
    const rows = await this.db
      .select({
        id: restaurantMarketMemberships.id,
        restaurantId: restaurantMarketMemberships.restaurantId,
        marketId: restaurantMarketMemberships.marketId,
        stallNumber: restaurantMarketMemberships.stallNumber,
        isPrimary: restaurantMarketMemberships.isPrimary,
        joinedAt: restaurantMarketMemberships.joinedAt,
        marketSlug: markets.slug,
        marketName: markets.name,
        marketType: markets.type,
        city: markets.city,
        district: markets.district,
      })
      .from(restaurantMarketMemberships)
      .innerJoin(markets, eq(restaurantMarketMemberships.marketId, markets.id))
      .where(
        and(
          eq(restaurantMarketMemberships.restaurantId, restaurantId),
          isNull(restaurantMarketMemberships.leftAt),
          eq(markets.isActive, true),
          isNull(markets.deletedAt),
        ),
      )
      .orderBy(desc(restaurantMarketMemberships.isPrimary), asc(markets.name));

    return {
      memberships: rows.map((row) => ({
        id: row.id,
        restaurantId: row.restaurantId,
        marketId: row.marketId,
        stallNumber: row.stallNumber,
        isPrimary: row.isPrimary,
        joinedAt: row.joinedAt,
        market: {
          id: row.marketId,
          slug: row.marketSlug,
          name: row.marketName,
          type: row.marketType,
          city: row.city,
          district: row.district,
        },
      })),
    };
  }

  async listRestaurantJoinRequests(restaurantId: string) {
    const rows = await this.db
      .select({
        id: marketJoinRequests.id,
        restaurantId: marketJoinRequests.restaurantId,
        marketId: marketJoinRequests.marketId,
        status: marketJoinRequests.status,
        message: marketJoinRequests.message,
        requestedAt: marketJoinRequests.requestedAt,
        resolvedAt: marketJoinRequests.resolvedAt,
        marketSlug: markets.slug,
        marketName: markets.name,
        marketType: markets.type,
        city: markets.city,
        district: markets.district,
      })
      .from(marketJoinRequests)
      .innerJoin(markets, eq(marketJoinRequests.marketId, markets.id))
      .where(eq(marketJoinRequests.restaurantId, restaurantId))
      .orderBy(desc(marketJoinRequests.requestedAt));

    return {
      requests: rows.map((row) => ({
        id: row.id,
        restaurantId: row.restaurantId,
        marketId: row.marketId,
        status: row.status,
        message: row.message,
        requestedAt: row.requestedAt,
        resolvedAt: row.resolvedAt,
        market: {
          id: row.marketId,
          slug: row.marketSlug,
          name: row.marketName,
          type: row.marketType,
          city: row.city,
          district: row.district,
        },
      })),
    };
  }

  async listJoinRequests(filters: AdminJoinRequestFilters = {}) {
    const conditions = [];
    if (filters.status) {
      conditions.push(eq(marketJoinRequests.status, filters.status));
    }

    const rows = await this.db
      .select({
        id: marketJoinRequests.id,
        restaurantId: marketJoinRequests.restaurantId,
        marketId: marketJoinRequests.marketId,
        status: marketJoinRequests.status,
        message: marketJoinRequests.message,
        requestedAt: marketJoinRequests.requestedAt,
        resolvedAt: marketJoinRequests.resolvedAt,
        marketSlug: markets.slug,
        marketName: markets.name,
        marketType: markets.type,
        city: markets.city,
        district: markets.district,
        restaurantName: restaurants.name,
        restaurantDistrict: restaurants.district,
        restaurantCity: restaurants.city,
      })
      .from(marketJoinRequests)
      .innerJoin(markets, eq(marketJoinRequests.marketId, markets.id))
      .innerJoin(
        restaurants,
        eq(marketJoinRequests.restaurantId, restaurants.id),
      )
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(marketJoinRequests.requestedAt));

    return {
      requests: rows.map((row) => ({
        id: row.id,
        restaurantId: row.restaurantId,
        marketId: row.marketId,
        status: row.status,
        message: row.message,
        requestedAt: row.requestedAt,
        resolvedAt: row.resolvedAt,
        market: {
          id: row.marketId,
          slug: row.marketSlug,
          name: row.marketName,
          type: row.marketType,
          city: row.city,
          district: row.district,
        },
        restaurant: {
          id: row.restaurantId,
          name: row.restaurantName,
          city: row.restaurantCity,
          district: row.restaurantDistrict,
        },
      })),
    };
  }

  async listVendorCandidates(filters: AdminVendorCandidateFilters = {}) {
    const limit = filters.limit ?? 10;
    const conditions = [
      eq(restaurants.isActive, true),
      isNull(restaurants.deletedAt),
    ];

    const query = filters.q?.trim();
    if (query) {
      const pattern = `%${query}%`;
      const searchCondition = or(
        like(restaurants.name, pattern),
        like(restaurants.address, pattern),
        like(restaurants.district, pattern),
        like(restaurants.city, pattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    if (filters.marketId) {
      conditions.push(sql`not exists (
        select 1
        from restaurant_market_memberships
        where restaurant_market_memberships.restaurant_id = ${restaurants.id}
          and restaurant_market_memberships.market_id = ${filters.marketId}
          and restaurant_market_memberships.left_at_ms is null
      )`);
    }

    const rows = await this.db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        city: restaurants.city,
        district: restaurants.district,
        address: restaurants.address,
        type: restaurants.type,
        category: restaurants.category,
        isAvailable: restaurants.isAvailable,
        supportsTakeaway: restaurants.supportsTakeaway,
        supportsDelivery: restaurants.supportsDelivery,
      })
      .from(restaurants)
      .where(and(...conditions))
      .orderBy(asc(restaurants.name))
      .limit(limit);

    return { restaurants: rows, total: rows.length };
  }

  async approveJoinRequest(
    requestId: number,
    input: { stallNumber?: string | null; isPrimary?: boolean } = {},
  ) {
    const request = await this.getJoinRequestById(requestId);
    if (!request) return { status: "not_found" as const };
    if (request.status !== "pending") return { status: "not_pending" as const };

    const membership = await this.addVendor(request.marketId, {
      restaurantId: request.restaurantId,
      stallNumber: input.stallNumber ?? null,
      isPrimary: input.isPrimary ?? false,
    });
    if (!membership) return { status: "market_not_found" as const };

    const [updated] = await this.db
      .update(marketJoinRequests)
      .set({
        status: "approved",
        resolvedAt: new Date(),
      })
      .where(eq(marketJoinRequests.id, requestId))
      .returning();

    return { status: "approved" as const, request: updated, membership };
  }

  async rejectJoinRequest(requestId: number) {
    const request = await this.getJoinRequestById(requestId);
    if (!request) return { status: "not_found" as const };
    if (request.status !== "pending") return { status: "not_pending" as const };

    const [updated] = await this.db
      .update(marketJoinRequests)
      .set({
        status: "rejected",
        resolvedAt: new Date(),
      })
      .where(eq(marketJoinRequests.id, requestId))
      .returning();

    return { status: "rejected" as const, request: updated };
  }

  async createJoinRequest(
    restaurantId: string,
    input: { marketId: string; message?: string | null },
  ) {
    const market = await this.getMarketById(input.marketId);
    if (!market || market.deletedAt || !market.isActive) {
      return { status: "not_found" as const };
    }

    const [activeMembership] = await this.db
      .select({ id: restaurantMarketMemberships.id })
      .from(restaurantMarketMemberships)
      .where(
        and(
          eq(restaurantMarketMemberships.restaurantId, restaurantId),
          eq(restaurantMarketMemberships.marketId, input.marketId),
          isNull(restaurantMarketMemberships.leftAt),
        ),
      )
      .limit(1);

    if (activeMembership) {
      return { status: "already_member" as const };
    }

    const [pendingRequest] = await this.db
      .select({ id: marketJoinRequests.id })
      .from(marketJoinRequests)
      .where(
        and(
          eq(marketJoinRequests.restaurantId, restaurantId),
          eq(marketJoinRequests.marketId, input.marketId),
          eq(marketJoinRequests.status, "pending"),
        ),
      )
      .limit(1);

    if (pendingRequest) {
      return { status: "already_pending" as const };
    }

    const [request] = await this.db
      .insert(marketJoinRequests)
      .values({
        restaurantId,
        marketId: input.marketId,
        status: "pending",
        message: input.message || null,
        requestedAt: new Date(),
      })
      .returning();

    return { status: "created" as const, request };
  }

  private async getJoinRequestById(requestId: number) {
    const [request] = await this.db
      .select()
      .from(marketJoinRequests)
      .where(eq(marketJoinRequests.id, requestId))
      .limit(1);

    return request ?? null;
  }

  private async publicCacheKey(scope: string, value: unknown) {
    const version = await this.getPublicCacheVersion();
    return `markets:v${version}:${scope}:${stableCacheValue(value)}`;
  }

  private async getPublicCacheVersion() {
    return (await this.kv?.get(MARKET_CACHE_VERSION_KEY)) ?? "1";
  }

  private async bumpPublicCacheVersion() {
    if (!this.kv) return;
    const current = Number(await this.getPublicCacheVersion());
    const next = Number.isFinite(current) ? current + 1 : Date.now();
    await this.kv.put(MARKET_CACHE_VERSION_KEY, String(next));
  }
}

function stableCacheValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return String(value);

  return JSON.stringify(sortCacheValue(value));
}

function sortCacheValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCacheValue);
  if (value === null || typeof value !== "object") return value;

  return Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<Record<string, unknown>>((sorted, [key, entry]) => {
      sorted[key] = sortCacheValue(entry);
      return sorted;
    }, {});
}
