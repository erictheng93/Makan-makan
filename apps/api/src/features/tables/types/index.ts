/**
 * Tables Feature Types
 *
 * Re-exports database types and defines feature-specific types
 */

// Re-export database layer types as the source of truth
export type {
  CreateTableData,
  UpdateTableData,
  TableFilters,
  QRCodeOptions,
  TableStats as DbTableStats,
} from "@makanmakan/database";

// Core table type (feature-specific, includes computed/joined fields)
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
  currentOrderId?: string | null;
  estimatedReleaseTime?: Date;
  lastCleanedAt?: Date;
  cleaningNotes?: string;
  maintenanceNotes?: string;
  qrCode?: string;
  qrCodeVersion?: number;
  pendingQrCode?: string | null;
  pendingQrCodeVersion?: number | null;
  pendingQrPreparedAt?: Date | null;
  qrMode?: "table" | "seat";
  seatCount?: number;
  seatNumberingStyle?: "numeric" | "alphabetic" | "custom";
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

// Feature-level stats (adapted from database stats)
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
export interface BulkQRRequest {
  restaurantId: string;
  tableIds: number[];
  options?: import("@makanmakan/database").QRCodeOptions;
}

export interface QRCodeResult {
  tableId: number;
  qrCode: string;
  url: string;
  format: string;
  size: string;
}

// Service response types
export interface ServiceResponse<T = unknown> {
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

// Re-export shared pagination type
export type { PaginatedResponse as PaginationResult } from "@makanmakan/shared-types";

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
