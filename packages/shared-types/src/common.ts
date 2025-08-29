// 通用型別定義

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

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export enum Status {
  INACTIVE = 0,
  ACTIVE = 1
}

export enum UserRole {
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

export enum SpiceLevel {
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