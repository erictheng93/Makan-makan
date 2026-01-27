/**
 * Menu Types
 * TypeScript type definitions for the menu feature
 */

// BaseEntity import available for future use

// Import shared menu types from @makanmakan/shared-types
import type {
  MenuItem as SharedMenuItem,
  Category as SharedCategory,
  MenuItemOptions as SharedMenuItemOptions,
  MenuStructure as SharedMenuStructure,
  CreateMenuItemRequest as SharedCreateMenuItemRequest,
  UpdateMenuItemRequest as SharedUpdateMenuItemRequest,
  CreateCategoryRequest as SharedCreateCategoryRequest,
  UpdateCategoryRequest as SharedUpdateCategoryRequest,
  DietaryInfo as SharedDietaryInfo,
  // SpiceLevel, // Available for future use
  ImageVariants as SharedImageVariants
} from '@makanmakan/shared-types'

// Menu Item Core Types
export interface MenuItemSize {
  id: string
  name: string
  priceAdjustment: number
  description?: string
  isDefault?: boolean
}

export interface MenuItemCustomization {
  id: string
  name: string
  type: 'single' | 'multiple'
  required: boolean
  maxSelections?: number
  choices: Array<{
    id: string
    name: string
    priceAdjustment?: number
    isDefault?: boolean
  }>
}

export interface MenuItemAddOn {
  id: string
  name: string
  price: number
  description?: string
  maxQuantity?: number
  category?: string
}

// Use shared MenuItemOptions type
export type MenuItemOptions = SharedMenuItemOptions

// Use shared types with feature extensions
export type DietaryInfo = SharedDietaryInfo & {
  organic?: boolean
  localSource?: boolean
}

export type ImageVariants = SharedImageVariants

export interface AvailableHours {
  start?: string // HH:mm
  end?: string   // HH:mm
  days?: number[] // 0-6 (Sunday to Saturday)
}

// Extended Menu Item Entity (extending shared type)
export interface MenuItem extends SharedMenuItem {
  costPrice?: number
  minInventoryAlert?: number
  availableHours?: AvailableHours
  rating?: number
  reviewCount: number
  viewCount: number
  tags?: string[]
  keywords?: string
}

// Extended Category Entity (extending shared type)
export interface Category extends SharedCategory {
  itemCount?: number
  isActive?: boolean
  isVisible?: boolean
}

// Extended Menu Structure
export interface MenuStructure extends SharedMenuStructure {
  categories: Category[]
  menuItems: MenuItem[]
}

// Data Transfer Objects (extending shared types)
export interface CreateMenuItemData extends SharedCreateMenuItemRequest {
  originalPrice?: number
  imageUrl?: string
  imageVariants?: ImageVariants
  availableHours?: AvailableHours
  tags?: string[]
  keywords?: string
}

export interface UpdateMenuItemData extends SharedUpdateMenuItemRequest {
  originalPrice?: number
  costPrice?: number
  sortOrder?: number
  inventoryCount?: number
  minInventoryAlert?: number
  availableHours?: AvailableHours
  rating?: number
  reviewCount?: number
  viewCount?: number
  tags?: string[]
  keywords?: string
}

export interface CreateCategoryData extends SharedCreateCategoryRequest {
  imageUrl?: string
}

export interface UpdateCategoryData extends SharedUpdateCategoryRequest {
  isActive?: boolean
  isVisible?: boolean
}

// Search and Filter Types
export interface MenuFilters {
  categoryId?: number
  priceRange?: [number, number]
  spiceLevel?: number
  dietaryPreferences?: string[]
  isAvailable?: boolean
  isFeatured?: boolean
  search?: string
}

export interface MenuSearchParams extends MenuFilters {
  page?: number
  limit?: number
}

export interface MenuSearchResult {
  items: MenuItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Bulk Operations
export interface BulkAvailabilityUpdate {
  id: number
  isAvailable: boolean
}

export interface BulkPriceUpdate {
  id: number
  price: number
  originalPrice?: number
}

export interface BulkCategoryMove {
  id: number
  categoryId: number
}

// Analytics and Statistics
export interface MenuAnalytics {
  totalItems: number
  availableItems: number
  featuredItems: number
  popularItems: number
  averagePrice: number
  priceRange: {
    min: number
    max: number
  }
  categoryDistribution: Array<{
    categoryId: number
    categoryName: string
    itemCount: number
    percentage: number
  }>
  topPerformingItems: Array<{
    id: number
    name: string
    orderCount: number
    revenue: number
    rating?: number
  }>
  dietaryInfoStats: {
    vegetarian: number
    vegan: number
    glutenFree: number
    halal: number
  }
  spiceLevelDistribution: Record<number, number>
}

export interface PopularityMetrics {
  mostOrdered: MenuItem[]
  mostViewed: MenuItem[]
  highestRated: MenuItem[]
  recentlyAdded: MenuItem[]
}

// Menu Management Operations
export interface MenuOperation {
  type: 'create' | 'update' | 'delete' | 'bulk_update'
  entityType: 'menu_item' | 'category'
  entityId?: number
  data?: any
  userId: number
  timestamp: Date
}

export interface MenuVersion {
  id: number
  restaurantId: string
  version: string
  changes: MenuOperation[]
  publishedAt?: Date
  isActive: boolean
  createdBy: number
  createdAt: Date
}

// Service Interfaces
export interface IMenuService {
  // Menu structure
  getMenu(restaurantId: string): Promise<MenuStructure | null>
  getMenuItem(id: number): Promise<MenuItem | null>

  // Menu items management
  createMenuItem(data: CreateMenuItemData): Promise<MenuItem>
  updateMenuItem(id: number, data: UpdateMenuItemData): Promise<MenuItem>
  deleteMenuItem(id: number): Promise<boolean>

  // Category management
  createCategory(data: CreateCategoryData): Promise<Category>
  updateCategory(id: number, data: UpdateCategoryData): Promise<Category>
  deleteCategory(id: number): Promise<boolean>

  // Search and filtering
  searchMenuItems(restaurantId: string, params: MenuSearchParams): Promise<MenuSearchResult>
  getFeaturedItems(restaurantId: string, limit?: number): Promise<MenuItem[]>
  getPopularItems(restaurantId: string, limit?: number): Promise<MenuItem[]>

  // Bulk operations
  batchUpdateAvailability(restaurantId: string, updates: BulkAvailabilityUpdate[]): Promise<void>
  batchUpdatePrices(restaurantId: string, updates: BulkPriceUpdate[]): Promise<void>
  batchMoveItems(restaurantId: string, moves: BulkCategoryMove[]): Promise<void>

  // Analytics
  getMenuAnalytics(restaurantId: string): Promise<MenuAnalytics>
  getPopularityMetrics(restaurantId: string): Promise<PopularityMetrics>

  // Utility functions
  incrementOrderCount(menuItemId: number, increment?: number): Promise<void>
  incrementViewCount(menuItemId: number): Promise<void>
  updateItemRating(menuItemId: number, rating: number): Promise<void>
}

// Event types for menu operations
export type MenuEvent =
  | { type: 'MENU_ITEM_CREATED'; payload: MenuItem }
  | { type: 'MENU_ITEM_UPDATED'; payload: MenuItem }
  | { type: 'MENU_ITEM_DELETED'; payload: { id: number; restaurantId: string } }
  | { type: 'CATEGORY_CREATED'; payload: Category }
  | { type: 'CATEGORY_UPDATED'; payload: Category }
  | { type: 'CATEGORY_DELETED'; payload: { id: number; restaurantId: string } }
  | { type: 'MENU_ITEM_VIEWED'; payload: { id: number; viewCount: number } }
  | { type: 'MENU_ITEM_ORDERED'; payload: { id: number; orderCount: number } }
  | { type: 'AVAILABILITY_UPDATED'; payload: { updates: BulkAvailabilityUpdate[] } }

// Error types specific to menu operations
export interface MenuError extends Error {
  code: 'MENU_ITEM_NOT_FOUND' | 'CATEGORY_NOT_FOUND' | 'INVALID_RESTAURANT' | 'DUPLICATE_NAME' | 'INVENTORY_INSUFFICIENT'
  details?: any
}

// Import/Export types
export interface MenuImportData {
  categories: Omit<CreateCategoryData, 'restaurantId'>[]
  menuItems: Omit<CreateMenuItemData, 'restaurantId'>[]
}

export interface MenuExportOptions {
  includeImages: boolean
  includeAnalytics: boolean
  format: 'json' | 'csv' | 'xlsx'
  categories?: number[]
}

// Nutritional information extended type
export interface NutritionalInfo {
  calories?: number
  protein?: number
  carbohydrates?: number
  fat?: number
  fiber?: number
  sugar?: number
  sodium?: number
  servingSize?: string
  servingsPerContainer?: number
}

// Menu customization themes
export interface MenuTheme {
  id: string
  name: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
  }
  fonts: {
    header: string
    body: string
    price: string
  }
  layout: 'grid' | 'list' | 'card'
  imageStyle: 'square' | 'rounded' | 'circle'
}