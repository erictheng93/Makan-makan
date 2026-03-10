/**
 * Shared Types
 * Common type definitions used across feature modules
 */

// Re-export from existing types
export type { Env } from "../../types/env";

// Common API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
    code: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Common entity base type
export interface BaseEntity {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

// Feature module interface
export interface FeatureModule {
  name: string;
  version: string;
  routes: unknown; // Will be Hono app instance
}
