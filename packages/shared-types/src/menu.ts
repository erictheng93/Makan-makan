import { BaseEntity, Status, DietaryInfo, SpiceLevel, ImageVariants } from './common';

export interface Category extends BaseEntity {
  restaurantId: number;
  name: string;
  description?: string;
  parentId?: number;
  sortOrder: number;
  status: Status;
}

export interface MenuItem extends BaseEntity {
  restaurantId: number;
  categoryId: number;
  name: string;
  description?: string;
  price: number; // in cents
  imageUrl?: string;
  imageVariants?: ImageVariants;
  dietaryInfo?: DietaryInfo;
  spiceLevel: SpiceLevel;
  options?: MenuItemOptions;
  sortOrder: number;
  isAvailable: boolean;
  isFeatured: boolean;
  inventoryCount: number; // -1 for unlimited
  orderCount: number;
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
    type: 'single' | 'multiple';
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
  restaurantId: number;
  name: string;
  description?: string;
  parentId?: number;
  sortOrder?: number;
}

export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {}

export interface CreateMenuItemRequest {
  restaurantId: number;
  categoryId: number;
  name: string;
  description?: string;
  price: number; // in cents
  dietaryInfo?: DietaryInfo;
  spiceLevel?: SpiceLevel;
  options?: MenuItemOptions;
  sortOrder?: number;
  inventoryCount?: number;
}

export interface UpdateMenuItemRequest extends Partial<CreateMenuItemRequest> {
  isAvailable?: boolean;
  isFeatured?: boolean;
}

export interface MenuStructure {
  categories: Category[];
  items: MenuItem[];
}

export interface PopularMenuItem extends MenuItem {
  orderFrequency: number;
  revenueContribution: number; // in cents
}