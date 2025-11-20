export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    meta?: {
        timestamp: string;
        requestId: string;
        version: string;
    };
}
export interface BaseEntity {
    id: number;
    createdAt: string;
    updatedAt: string;
}
export declare enum Status {
    INACTIVE = 0,
    ACTIVE = 1
}
export declare enum UserRole {
    ADMIN = 0,
    OWNER = 1,
    CHEF = 2,
    SERVICE = 3,
    CASHIER = 4
}
export interface DietaryInfo {
    vegetarian?: boolean;
    vegan?: boolean;
    halal?: boolean;
    glutenFree?: boolean;
    dairyFree?: boolean;
    nutFree?: boolean;
}
export declare enum SpiceLevel {
    NONE = 0,
    MILD = 1,
    MEDIUM = 2,
    HOT = 3,
    EXTREME = 4
}
export interface BusinessHours {
    monday?: string;
    tuesday?: string;
    wednesday?: string;
    thursday?: string;
    friday?: string;
    saturday?: string;
    sunday?: string;
}
export interface ImageVariants {
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    original?: string;
}
//# sourceMappingURL=common.d.ts.map