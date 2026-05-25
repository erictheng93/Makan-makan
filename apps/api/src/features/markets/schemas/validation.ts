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
