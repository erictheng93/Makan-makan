import { z } from "zod";

export const marketListQuerySchema = z.object({
  city: z.string().optional(),
  district: z.string().optional(),
  type: z
    .enum(["night_market", "commercial_district", "food_court", "event_venue"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const nearbyMarketsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(10).default(2),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const marketSlugParamSchema = z.object({
  slug: z.string().min(1).max(120),
});

export const marketVendorsQuerySchema = z.object({
  openNow: z.coerce.boolean().optional(),
  takeaway: z.coerce.boolean().optional(),
  delivery: z.coerce.boolean().optional(),
  q: z.string().min(1).max(100).optional(),
  sortBy: z.enum(["rating", "popular"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const marketIdParamSchema = z.object({
  id: z.string().min(1).max(120),
});

export const marketVendorParamSchema = z.object({
  id: z.string().min(1).max(120),
  restaurantId: z.string().min(1).max(120),
});

export const createMarketSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(120),
  name: z.string().min(1).max(120),
  type: z.enum([
    "night_market",
    "commercial_district",
    "food_court",
    "event_venue",
  ]),
  description: z.string().max(5000).nullable().optional(),
  city: z.string().min(1).max(80),
  district: z.string().min(1).max(80),
  address: z.string().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  openingHours: z.record(z.any()).nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  imageUrls: z.array(z.string().url()).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateMarketSchema = createMarketSchema.partial();

export const addMarketVendorSchema = z.object({
  restaurantId: z.string().min(1).max(120),
  stallNumber: z.string().max(80).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export const createMarketJoinRequestSchema = z.object({
  marketId: z.string().min(1).max(120),
  message: z.string().trim().max(500).nullable().optional(),
});

export const adminMarketJoinRequestsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const marketJoinRequestIdParamSchema = z.object({
  requestId: z.coerce.number().int().min(1),
});

export const approveMarketJoinRequestSchema = z.object({
  stallNumber: z.string().max(80).nullable().optional(),
  isPrimary: z.boolean().optional(),
});
