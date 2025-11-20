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
    ingredients?: string;
    price: number;
    originalPrice?: number;
    imageUrl?: string;
    imageVariants?: ImageVariants;
    dietaryInfo?: DietaryInfo;
    spiceLevel: SpiceLevel;
    options?: MenuItemOptions;
    sortOrder: number;
    isAvailable: boolean;
    isFeatured: boolean;
    isPopular?: boolean;
    preparationTime?: number;
    calories?: number;
    allergens?: string[];
    inventoryCount: number;
    orderCount: number;
    category?: Category;
}
export interface MenuItemOptions {
    sizes?: {
        id: string;
        name: string;
        priceAdjustment: number;
        description?: string;
        priceModifier?: number;
    }[];
    customizations?: {
        id: string;
        name: string;
        type: 'single' | 'multiple';
        choices: {
            id: string;
            name: string;
            priceAdjustment: number;
            description?: string;
            priceModifier?: number;
        }[];
        required?: boolean;
    }[];
    addOns?: {
        id: string;
        name: string;
        price: number;
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
export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {
}
export interface CreateMenuItemRequest {
    restaurantId: number;
    categoryId: number;
    name: string;
    description?: string;
    price: number;
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
    menuItems: MenuItem[];
}
export interface PopularMenuItem extends MenuItem {
    orderFrequency: number;
    revenueContribution: number;
}
//# sourceMappingURL=menu.d.ts.map