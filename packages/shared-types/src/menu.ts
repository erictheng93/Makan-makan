import {
  BaseEntity,
  Status,
  DietaryInfo,
  SpiceLevel,
  ImageVariants,
} from "./common";

export interface Category extends BaseEntity {
  restaurantId: string;
  name: string;
  /** Optional English name, shown alongside `name` (#107). */
  nameEn?: string | null;
  description?: string;
  parentId?: number;
  sortOrder: number;
  status: Status;
  imageUrl?: string | null;
  /**
   * Visibility is two independent flags, and `status` only carries `isActive`.
   * Both are surfaced so an admin client can tell a hidden category apart from
   * a visible one instead of losing it entirely (#83). Absent on responses
   * built from shapes that do not carry them.
   */
  isActive?: boolean;
  isVisible?: boolean;
  /**
   * Live count of the items in this category. Optional on purpose: there is no
   * stored categories.item_count any more (#84), so call sites that return a
   * bare category row — create/update responses — omit it rather than report a
   * fabricated 0.
   */
  itemCount?: number;
}

export interface MenuItem extends BaseEntity {
  restaurantId: string;
  categoryId: number;
  catalogType: "menu_item" | "product";
  name: string;
  /** Optional English name, shown alongside `name` (#107). */
  nameEn?: string | null;
  description?: string;
  ingredients?: string;
  price: number; // in cents
  originalPrice?: number; // original price for promotional items
  imageUrl?: string;
  imageId?: string | null;
  imageVariants?: ImageVariants;
  dietaryInfo?: DietaryInfo;
  spiceLevel: SpiceLevel;
  options?: MenuItemOptions;
  sortOrder: number;
  isAvailable: boolean;
  isFeatured: boolean;
  isPopular?: boolean;
  preparationTime?: number; // preparation time in minutes
  calories?: number; // calorie content
  allergens?: string[]; // allergen information
  // null means stock is not tracked; a number is a real count, and 0 is sold
  // out. The "-1 for unlimited" this used to declare was never written or read
  // anywhere — the column is nullable and the order path claims stock with
  // `inventoryCount IS NULL OR inventoryCount >= quantity` (#166).
  inventoryCount: number | null;
  orderCount: number;
  /**
   * Engagement counters. Written by the DB layer (incrementViewCount and the
   * rating update path) and now actually read back — they used to be dropped in
   * the mappers, so every consumer saw 0 (#84).
   */
  rating?: number;
  reviewCount?: number;
  viewCount?: number;
  category?: Category; // populated when needed
}

export interface MenuItemOptions {
  sizes?: {
    id: string;
    name: string;
    priceAdjustment: number; // in cents, can be negative
    description?: string;
    priceModifier?: number; // alias for priceAdjustment
  }[];
  customizations?: {
    id: string;
    name: string;
    type: "single" | "multiple";
    choices: {
      id: string;
      name: string;
      priceAdjustment: number; // in cents
      description?: string;
      priceModifier?: number; // alias for priceAdjustment
    }[];
    required?: boolean;
  }[];
  addOns?: {
    id: string;
    name: string;
    price: number; // in cents
    available?: boolean;
    description?: string;
  }[];
}

export interface CreateCategoryRequest {
  restaurantId: string;
  name: string;
  nameEn?: string | null;
  description?: string;
  parentId?: number;
  sortOrder?: number;
}

export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {}

export interface CreateMenuItemRequest {
  restaurantId: string;
  categoryId: number;
  catalogType?: "menu_item" | "product";
  name: string;
  nameEn?: string | null;
  description?: string;
  price: number; // in cents
  imageId?: string | null;
  dietaryInfo?: DietaryInfo;
  spiceLevel?: SpiceLevel;
  options?: MenuItemOptions;
  sortOrder?: number;
  inventoryCount?: number | null;
  isAvailable?: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
}

export interface UpdateMenuItemRequest extends Partial<CreateMenuItemRequest> {}

export interface MenuStructure {
  categories: Category[];
  menuItems: MenuItem[];
}

export interface PopularMenuItem extends MenuItem {
  orderFrequency: number;
  revenueContribution: number; // in cents
}
