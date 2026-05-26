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
  dishSearchIndex,
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
import { evaluateMarketPublicReadiness } from "../utils/publicReadiness";

const MARKET_CACHE_VERSION_KEY = "markets:version";

export interface MarketFilters {
  q?: string;
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

export interface MarketCatalogCoverage {
  searchableProductCount: number;
  publicServiceCount: number;
  vendorsWithSearchableProducts?: number;
  vendorsMissingSearchableProducts?: number;
  vendorsWithPublicServices?: number;
  vendorsMissingPublicServices?: number;
  missingProductVendors?: MarketCatalogGapVendor[];
  missingServiceVendors?: MarketCatalogGapVendor[];
}

export interface MarketCatalogGapVendor {
  restaurantId: string;
  name: string;
  stallNumber: string | null;
}

export interface MarketAreaReadinessSummary {
  city: string;
  district: string;
  marketCount: number;
  vendorCount: number;
  searchableProductCount: number;
  publicServiceCount: number;
  vendorsMissingSearchableProducts: number;
  vendorsMissingPublicServices: number;
  totalCatalogGapVendors: number;
  averageReadinessScore: number;
}

export type CreateMarketInput = typeof markets.$inferInsert;
export type UpdateMarketInput = Partial<typeof markets.$inferInsert>;

export class MarketsService {
  private db;
  private d1: D1Database;
  private cache: CacheService;
  private kv?: KVNamespace;

  constructor(d1: D1Database, kv?: KVNamespace) {
    this.db = drizzle(d1);
    this.d1 = d1;
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

  async listAdminReadiness(filters: MarketFilters) {
    const data = await this.queryMarkets(filters, {
      includeVendorBreakdown: true,
    });
    return data;
  }

  async listAreaReadiness(limit = 50000) {
    const data = await this.queryMarkets(
      { limit },
      { includeVendorBreakdown: true },
    );
    const summaries = new Map<string, MarketAreaReadinessSummary>();
    const readinessTotals = new Map<
      string,
      { scoreTotal: number; scoredMarkets: number }
    >();

    for (const market of data.markets) {
      const key = `${market.city}\u0000${market.district}`;
      const coverage = market.catalogCoverage;
      const summary =
        summaries.get(key) ??
        ({
          city: market.city,
          district: market.district,
          marketCount: 0,
          vendorCount: 0,
          searchableProductCount: 0,
          publicServiceCount: 0,
          vendorsMissingSearchableProducts: 0,
          vendorsMissingPublicServices: 0,
          totalCatalogGapVendors: 0,
          averageReadinessScore: 0,
        } satisfies MarketAreaReadinessSummary);
      const readinessTotal = readinessTotals.get(key) ?? {
        scoreTotal: 0,
        scoredMarkets: 0,
      };

      summary.marketCount += 1;
      summary.vendorCount += market.vendorCount;
      summary.searchableProductCount += coverage.searchableProductCount;
      summary.publicServiceCount += coverage.publicServiceCount;
      summary.vendorsMissingSearchableProducts +=
        coverage.vendorsMissingSearchableProducts ?? 0;
      summary.vendorsMissingPublicServices +=
        coverage.vendorsMissingPublicServices ?? 0;
      summary.totalCatalogGapVendors =
        summary.vendorsMissingSearchableProducts +
        summary.vendorsMissingPublicServices;

      if (market.publicReadiness) {
        readinessTotal.scoreTotal += market.publicReadiness.score;
        readinessTotal.scoredMarkets += 1;
        summary.averageReadinessScore = Math.round(
          readinessTotal.scoreTotal / readinessTotal.scoredMarkets,
        );
      }

      summaries.set(key, summary);
      readinessTotals.set(key, readinessTotal);
    }

    return {
      areas: Array.from(summaries.values()).sort((left, right) => {
        const gapDelta =
          right.totalCatalogGapVendors - left.totalCatalogGapVendors;
        if (gapDelta !== 0) return gapDelta;
        const cityDelta = left.city.localeCompare(right.city, "zh-Hant");
        if (cityDelta !== 0) return cityDelta;
        return left.district.localeCompare(right.district, "zh-Hant");
      }),
    };
  }

  async listSitemapEntries(limit = 50000) {
    const rows = await this.db
      .select({
        slug: markets.slug,
        updatedAt: markets.updatedAt,
      })
      .from(markets)
      .where(and(eq(markets.isActive, true), isNull(markets.deletedAt)))
      .orderBy(desc(markets.updatedAt), asc(markets.name))
      .limit(limit);

    return rows;
  }

  async listAreas() {
    const cacheKey = await this.publicCacheKey("areas", "all");
    const cached =
      await this.cache.get<Awaited<ReturnType<MarketsService["queryAreas"]>>>(
        cacheKey,
      );
    if (cached) return cached;

    const data = await this.queryAreas();
    await this.cache.set(cacheKey, data, CACHE_TTL.SHORT);
    return data;
  }

  private async queryAreas() {
    const rows = await this.db
      .select({
        city: markets.city,
        district: markets.district,
      })
      .from(markets)
      .where(and(eq(markets.isActive, true), isNull(markets.deletedAt)))
      .groupBy(markets.city, markets.district)
      .orderBy(asc(markets.city), asc(markets.district));

    const areas = rows.reduce<{ city: string; districts: string[] }[]>(
      (acc, row) => {
        let area = acc.find((entry) => entry.city === row.city);
        if (!area) {
          area = { city: row.city, districts: [] };
          acc.push(area);
        }
        area.districts.push(row.district);
        return acc;
      },
      [],
    );

    return { areas };
  }

  private async queryMarkets(
    filters: MarketFilters,
    options: { includeVendorBreakdown?: boolean } = {},
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const offset = (page - 1) * limit;
    const conditions = [eq(markets.isActive, true), isNull(markets.deletedAt)];

    if (filters.city) conditions.push(eq(markets.city, filters.city));
    if (filters.district)
      conditions.push(eq(markets.district, filters.district));
    if (filters.type) conditions.push(eq(markets.type, filters.type));
    if (filters.q) {
      const pattern = `%${filters.q.trim()}%`;
      conditions.push(
        or(
          like(markets.name, pattern),
          like(markets.slug, pattern),
          like(markets.description, pattern),
          like(markets.tags, pattern),
        )!,
      );
    }

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
        updatedAt: markets.updatedAt,
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

    const marketsWithCoverage = await Promise.all(
      rows.map(async (row) => {
        const vendorCount = Number(row.vendorCount);
        const catalogCoverage = options.includeVendorBreakdown
          ? await this.catalogCoverageWithVendorBreakdown(row.id)
          : await this.countCatalogCoverage(row.id);

        return {
          ...row,
          vendorCount,
          catalogCoverage,
          publicReadiness: evaluateMarketPublicReadiness({
            ...row,
            vendorCount,
            ...catalogCoverage,
          }),
        };
      }),
    );

    return {
      markets: marketsWithCoverage,
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

    const vendorCount = Number(count);
    const catalogCoverage = await this.countCatalogCoverage(market.id);

    return {
      market,
      vendorCount,
      catalogCoverage,
      publicReadiness: evaluateMarketPublicReadiness({
        ...market,
        vendorCount,
        ...catalogCoverage,
      }),
    };
  }

  private async countCatalogCoverage(
    marketId: string,
  ): Promise<MarketCatalogCoverage> {
    const [productRows, serviceCount] = await Promise.all([
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(dishSearchIndex)
        .innerJoin(
          restaurants,
          eq(dishSearchIndex.restaurantId, restaurants.id),
        )
        .where(
          and(
            eq(dishSearchIndex.isAvailable, true),
            eq(restaurants.isActive, true),
            isNull(restaurants.deletedAt),
            or(
              eq(dishSearchIndex.primaryMarketId, marketId),
              like(dishSearchIndex.marketIds, `%"${marketId}"%`),
            ),
          ),
        ),
      this.countPublicServicesForMarket(marketId),
    ]);

    return {
      searchableProductCount: Number(productRows[0]?.count ?? 0),
      publicServiceCount: serviceCount,
    };
  }

  private async countPublicServicesForMarket(marketId: string) {
    const row = await this.d1
      .prepare(
        `SELECT count(distinct rsi.id) as count
         FROM restaurant_service_items rsi
         INNER JOIN restaurants r ON rsi.restaurant_id = r.id
         INNER JOIN restaurant_market_memberships rmm
           ON rmm.restaurant_id = r.id
          AND rmm.market_id = ?
          AND rmm.left_at_ms IS NULL
         WHERE rsi.is_active = 1
           AND rsi.is_public = 1
           AND rsi.deleted_at_ms IS NULL
           AND r.is_active = 1
           AND r.deleted_at_ms IS NULL`,
      )
      .bind(marketId)
      .first<{ count: number }>();

    return Number(row?.count ?? 0);
  }

  private async catalogCoverageWithVendorBreakdown(
    marketId: string,
  ): Promise<Required<MarketCatalogCoverage>> {
    const [coverage, vendorRows] = await Promise.all([
      this.countCatalogCoverage(marketId),
      this.db
        .select({
          restaurantId: restaurants.id,
          name: restaurants.name,
          stallNumber: restaurantMarketMemberships.stallNumber,
        })
        .from(restaurantMarketMemberships)
        .innerJoin(
          restaurants,
          eq(restaurantMarketMemberships.restaurantId, restaurants.id),
        )
        .where(
          and(
            eq(restaurantMarketMemberships.marketId, marketId),
            isNull(restaurantMarketMemberships.leftAt),
            eq(restaurants.isActive, true),
            isNull(restaurants.deletedAt),
          ),
        )
        .orderBy(asc(restaurants.name)),
    ]);

    if (vendorRows.length === 0) {
      return {
        ...coverage,
        vendorsWithSearchableProducts: 0,
        vendorsMissingSearchableProducts: 0,
        vendorsWithPublicServices: 0,
        vendorsMissingPublicServices: 0,
        missingProductVendors: [],
        missingServiceVendors: [],
      };
    }

    const productRows = await this.db
      .select({
        restaurantId: dishSearchIndex.restaurantId,
      })
      .from(dishSearchIndex)
      .innerJoin(restaurants, eq(dishSearchIndex.restaurantId, restaurants.id))
      .where(
        and(
          eq(dishSearchIndex.isAvailable, true),
          eq(restaurants.isActive, true),
          isNull(restaurants.deletedAt),
          or(
            eq(dishSearchIndex.primaryMarketId, marketId),
            like(dishSearchIndex.marketIds, `%"${marketId}"%`),
          ),
        ),
      )
      .groupBy(dishSearchIndex.restaurantId);

    const serviceRows = await this.listVendorIdsWithPublicServices(marketId);

    const vendorsWithProducts = new Set(
      productRows.map((row) => row.restaurantId),
    );
    const vendorsWithServices = new Set(
      serviceRows.map((row) => row.restaurantId),
    );
    const vendorsWithSearchableProductsCount = vendorRows.filter((vendor) =>
      vendorsWithProducts.has(vendor.restaurantId),
    ).length;
    const vendorsWithPublicServicesCount = vendorRows.filter((vendor) =>
      vendorsWithServices.has(vendor.restaurantId),
    ).length;
    const missingProductVendors = vendorRows
      .filter((vendor) => !vendorsWithProducts.has(vendor.restaurantId))
      .map((vendor) => ({
        restaurantId: vendor.restaurantId,
        name: vendor.name,
        stallNumber: vendor.stallNumber,
      }));
    const missingServiceVendors = vendorRows
      .filter((vendor) => !vendorsWithServices.has(vendor.restaurantId))
      .map((vendor) => ({
        restaurantId: vendor.restaurantId,
        name: vendor.name,
        stallNumber: vendor.stallNumber,
      }));

    return {
      ...coverage,
      vendorsWithSearchableProducts: vendorsWithSearchableProductsCount,
      vendorsMissingSearchableProducts: missingProductVendors.length,
      vendorsWithPublicServices: vendorsWithPublicServicesCount,
      vendorsMissingPublicServices: missingServiceVendors.length,
      missingProductVendors,
      missingServiceVendors,
    };
  }

  private async listVendorIdsWithPublicServices(marketId: string) {
    const result = await this.d1
      .prepare(
        `SELECT rsi.restaurant_id as restaurantId
         FROM restaurant_service_items rsi
         INNER JOIN restaurants r ON rsi.restaurant_id = r.id
         INNER JOIN restaurant_market_memberships rmm
           ON rmm.restaurant_id = r.id
          AND rmm.market_id = ?
          AND rmm.left_at_ms IS NULL
         WHERE rsi.is_active = 1
           AND rsi.is_public = 1
           AND rsi.deleted_at_ms IS NULL
           AND r.is_active = 1
           AND r.deleted_at_ms IS NULL
         GROUP BY rsi.restaurant_id`,
      )
      .bind(marketId)
      .all<{ restaurantId: string }>();

    return result.results ?? [];
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

    const existing = await this.getActiveVendorMembership(
      marketId,
      input.restaurantId,
    );
    if (existing) {
      if (input.isPrimary) {
        await this.clearPrimaryMembership(input.restaurantId);
      }

      const [membership] = await this.db
        .update(restaurantMarketMemberships)
        .set({
          stallNumber:
            input.stallNumber !== undefined
              ? input.stallNumber
              : existing.stallNumber,
          isPrimary:
            input.isPrimary !== undefined
              ? input.isPrimary
              : existing.isPrimary,
        })
        .where(eq(restaurantMarketMemberships.id, existing.id))
        .returning();
      await this.bumpPublicCacheVersion();
      return membership ?? existing;
    }

    if (input.isPrimary) {
      await this.clearPrimaryMembership(input.restaurantId);
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

  async getActiveVendorMembership(marketId: string, restaurantId: string) {
    const [membership] = await this.db
      .select()
      .from(restaurantMarketMemberships)
      .where(
        and(
          eq(restaurantMarketMemberships.marketId, marketId),
          eq(restaurantMarketMemberships.restaurantId, restaurantId),
          isNull(restaurantMarketMemberships.leftAt),
        ),
      )
      .limit(1);

    return membership ?? null;
  }

  private async clearPrimaryMembership(restaurantId: string) {
    await this.db
      .update(restaurantMarketMemberships)
      .set({ isPrimary: false })
      .where(
        and(
          eq(restaurantMarketMemberships.restaurantId, restaurantId),
          isNull(restaurantMarketMemberships.leftAt),
        ),
      );
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
