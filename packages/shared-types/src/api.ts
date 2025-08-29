import { ApiResponse, PaginationParams } from './common';

// HTTP 方法
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// API 錯誤碼
export enum ApiErrorCode {
  // 通用錯誤
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  
  // 認證錯誤
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  
  // 業務邏輯錯誤
  RESTAURANT_NOT_FOUND = 'RESTAURANT_NOT_FOUND',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  MENU_ITEM_NOT_AVAILABLE = 'MENU_ITEM_NOT_AVAILABLE',
  TABLE_OCCUPIED = 'TABLE_OCCUPIED',
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
  INSUFFICIENT_INVENTORY = 'INSUFFICIENT_INVENTORY',
  
  // 速率限制
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // 網路錯誤
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT'
}

// API 請求配置
export interface ApiRequestConfig {
  method: HttpMethod;
  url: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

// API 響應配置
export interface ApiResponseConfig {
  data: any;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// API 錯誤詳情
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: any;
  field?: string;
  timestamp?: string;
  requestId?: string;
}

// 分頁響應
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// 查詢過濾器基礎介面
export interface BaseFilter extends PaginationParams {
  search?: string;
  status?: number | number[];
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
}

// 文件上傳響應
export interface FileUploadResponse {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  variants?: Record<string, string>;
}

// 批量操作請求
export interface BulkOperationRequest<T = any> {
  operation: 'create' | 'update' | 'delete';
  items: T[];
  options?: {
    continueOnError?: boolean;
    validateOnly?: boolean;
  };
}

// 批量操作響應
export interface BulkOperationResponse<T = any> {
  success: T[];
  errors: Array<{
    index: number;
    item: T;
    error: ApiError;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

// 健康檢查響應
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: boolean;
    cache: boolean;
    storage: boolean;
    queue: boolean;
  };
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
}

// Menu API specific response types
export interface MenuApiResponse {
  restaurant: {
    id: number;
    name: string;
    description?: string;
    imageUrl?: string;
  };
  categories: Array<{
    id: number;
    name: string;
    description?: string;
    items: Array<{
      id: number;
      name: string;
      description?: string;
      price: number;
      imageUrl?: string;
      options?: any;
      isAvailable: boolean;
      isFeatured: boolean;
    }>;
  }>;
  items?: Array<{
    id: number;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    options?: any;
    isAvailable: boolean;
    isFeatured: boolean;
    categoryId?: number;
  }>; // Flat list of all items for convenience
}

// API WebSocket message types (simpler for API responses)
export interface ApiWebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  channel?: string;
}