/**
 * Tables Feature Types
 *
 * Type definitions for the tables management feature module
 */

// Core table types
export interface Table {
  id: number;
  restaurantId: string;
  number: string;
  name?: string;
  capacity: number;
  location?: string;
  floor: number;
  section?: string;
  features?: TableFeatures;
  isActive: boolean;
  isOccupied: boolean;
  isReservable: boolean;
  occupiedBy?: string;
  occupiedAt?: Date;
  orderId?: number;
  estimatedReleaseTime?: Date;
  lastCleanedAt?: Date;
  cleaningNotes?: string;
  maintenanceNotes?: string;
  qrCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TableFeatures {
  hasChargingPort?: boolean;
  hasWifi?: boolean;
  isAccessible?: boolean;
  hasView?: boolean;
  isQuietZone?: boolean;
  smokingAllowed?: boolean;
}

// Table operation types
export interface CreateTableData {
  restaurantId: string;
  number: string;
  name?: string;
  capacity: number;
  location?: string;
  floor?: number;
  section?: string;
  features?: TableFeatures;
  isReservable?: boolean;
}

export interface UpdateTableData {
  number?: string;
  name?: string;
  capacity?: number;
  location?: string;
  floor?: number;
  section?: string;
  features?: TableFeatures;
  isActive?: boolean;
  isReservable?: boolean;
  maintenanceNotes?: string;
}

export interface TableFilters {
  restaurantId?: string;
  floor?: number;
  section?: string;
  isOccupied?: boolean;
  isActive?: boolean;
  isReservable?: boolean;
  minCapacity?: number;
  maxCapacity?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface TableStats {
  total: number;
  occupied: number;
  available: number;
  outOfService: number;
  avgOccupancyTime: number;
  totalCapacity: number;
  utilizationRate: number;
  floorDistribution: Array<{
    floor: number;
    total: number;
    occupied: number;
  }>;
}

// QR Code generation types
export interface QRCodeOptions {
  size?: "small" | "medium" | "large";
  format?: "png" | "svg" | "pdf";
  includeTableInfo?: boolean;
  customData?: any;
}

export interface BulkQRRequest {
  restaurantId: string;
  tableIds: number[];
  options?: QRCodeOptions;
}

export interface QRCodeResult {
  tableId: number;
  qrCode: string;
  url: string;
  format: string;
  size: string;
}

// Pagination types
export interface PaginationResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface TableListResult {
  tables: Table[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Service response types
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface QRRegenerateResult {
  success: boolean;
  qrCode?: string;
  error?: string;
}

export interface BulkQRResult {
  success: boolean;
  qrCodes?: QRCodeResult[];
  error?: string;
  failed?: Array<{
    tableId: number;
    error: string;
  }>;
}
