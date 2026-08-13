// 通用型別定義

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Base entity for UUID-based tables (like restaurants)
 */
export interface UUIDEntity {
  id: string; // UUID v7
  createdAt: string;
  updatedAt: string;
}

export enum Status {
  INACTIVE = 0,
  ACTIVE = 1,
}

export enum UserRole {
  ADMIN = 0,
  OWNER = 1,
  CHEF = 2,
  SERVICE = 3,
  CASHIER = 4,
  CUSTOMER = 5,
}

export interface DietaryInfo {
  vegetarian?: boolean;
  vegan?: boolean;
  halal?: boolean;
  glutenFree?: boolean;
  dairyFree?: boolean;
  nutFree?: boolean;
}

export enum SpiceLevel {
  NONE = 0,
  MILD = 1,
  MEDIUM = 2,
  HOT = 3,
  EXTREME = 4,
}

export interface BusinessHoursDay {
  open: string;
  close: string;
  isOpen: boolean;
}

export type BusinessHours = Record<string, BusinessHoursDay>;

export interface ImageVariants {
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  original?: string;
}
