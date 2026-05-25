import { z } from "zod";

export const dishSearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  district: z.string().optional(),
  city: z.string().optional(),
  marketId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.1).max(10).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  openNow: z.coerce.boolean().optional(),
  takeaway: z.coerce.boolean().optional(),
  delivery: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const restaurantBrowseQuerySchema = z.object({
  q: z.string().min(1).max(100).optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  marketId: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.1).max(10).optional(),
  cuisineType: z.string().optional(),
  priceRange: z.coerce.number().int().min(1).max(3).optional(),
  openNow: z.coerce.boolean().optional(),
  takeaway: z.coerce.boolean().optional(),
  delivery: z.coerce.boolean().optional(),
  sortBy: z.enum(["rating", "popular"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const restaurantIdParamSchema = z.object({
  id: z.string().min(1),
});
