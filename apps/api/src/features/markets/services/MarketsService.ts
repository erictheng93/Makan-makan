import { drizzle } from "drizzle-orm/d1";
import { and, asc, desc, eq, gte, isNull, like, lte, sql } from "drizzle-orm";
import {
  marketJoinRequests,
  markets,
  restaurantMarketMemberships,
  restaurants,
} from "@makanmakan/database";
import { isOpenNow } from "../../discovery/utils/isOpenNow";
import { boundingBoxFromCircle, distanceKm } from "./geo";

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

export type CreateMarketInput = typeof markets.$inferInsert;
export type UpdateMarketInput = Partial<typeof markets.$inferInsert>;

export class MarketsService {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async listMarkets(filters: MarketFilters) {
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
        bannerUrl: markets.bannerUrl,
        logoUrl: markets.logoUrl,
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
        bannerUrl: markets.bannerUrl,
        logoUrl: markets.logoUrl,
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
    return result.length > 0;
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
}
