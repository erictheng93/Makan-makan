/**
 * Menu API Response Contracts
 *
 * Defines the STABLE response shapes for menu endpoints.
 * Customer app (public menu), admin dashboard depend on these.
 */

import { z } from "zod";
import {
  successEnvelope,
  successWithMessage,
  PaginationSchema,
  TimestampFields,
} from "../helpers";

// ---------------------------------------------------------------------------
// Entity Schemas
// ---------------------------------------------------------------------------

export const CategorySchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    restaurantId: z.string(),
    name: z.string(),
    description: z.string().optional().nullable(),
    sortOrder: z.number().optional(),
    isActive: z.union([z.boolean(), z.number()]).optional(),
    ...TimestampFields,
  })
  .passthrough();

export const MenuItemSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    restaurantId: z.string(),
    categoryId: z.union([z.number(), z.string()]).optional().nullable(),
    name: z.string(),
    description: z.string().optional().nullable(),
    price: z.number(),
    imageUrl: z.string().optional().nullable(),
    isAvailable: z.union([z.boolean(), z.number()]).optional(),
    isActive: z.union([z.boolean(), z.number()]).optional(),
    isFeatured: z.union([z.boolean(), z.number()]).optional(),
    customizations: z.unknown().optional().nullable(),
    sizes: z.unknown().optional().nullable(),
    addOns: z.unknown().optional().nullable(),
    dietaryInfo: z.unknown().optional().nullable(),
    preparationTime: z.number().optional().nullable(),
    sortOrder: z.number().optional(),
    ...TimestampFields,
  })
  .passthrough();

export const FullMenuSchema = z
  .object({
    categories: z
      .array(
        CategorySchema.extend({
          items: z.array(MenuItemSchema).optional(),
        }),
      )
      .optional(),
    items: z.array(MenuItemSchema).optional(),
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

/** GET /:restaurantId — full menu (public) */
export const GetMenuResponse = successEnvelope(FullMenuSchema);

/** GET /:restaurantId/featured — featured items */
export const GetFeaturedResponse = successEnvelope(z.array(MenuItemSchema));

/** GET /:restaurantId/popular — popular items */
export const GetPopularResponse = successEnvelope(z.array(MenuItemSchema));

/** GET /:restaurantId/search — search results with pagination */
export const SearchMenuResponse = z.object({
  success: z.literal(true),
  data: z.array(MenuItemSchema),
  pagination: PaginationSchema.optional(),
});

/** GET /items/:id — single menu item */
export const GetMenuItemResponse = successEnvelope(MenuItemSchema);

/** POST /:restaurantId/items — create item */
export const CreateMenuItemResponse = successWithMessage(MenuItemSchema);

/** PUT /items/:id — update item */
export const UpdateMenuItemResponse = successWithMessage(MenuItemSchema);

/** DELETE /items/:id — delete item */
export const DeleteMenuItemResponse = successWithMessage(z.null());

/** POST /:restaurantId/categories — create category */
export const CreateCategoryResponse = successWithMessage(CategorySchema);

/** PUT /categories/:id — update category */
export const UpdateCategoryResponse = successWithMessage(CategorySchema);

/** DELETE /categories/:id — delete category */
export const DeleteCategoryResponse = successWithMessage(z.null());

/** PATCH /:restaurantId/items/availability — bulk update */
export const BulkUpdateResponse = successWithMessage(z.null());
