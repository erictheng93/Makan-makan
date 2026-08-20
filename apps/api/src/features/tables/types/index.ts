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
} from "@makanmasak/database";

/**
 * Core table type (feature-specific, includes computed/joined fields).
 *
 * Optionality here mirrors the queries rather than the schema: nullable
 * columns arrive as `null`, not absent. The projections used to disagree about
 * which columns they selected at all — the list query omitted `restaurantId`
 * and `updatedAt`, the availability query omitted both timestamps — which went
 * unnoticed while the service returned `any`. They now all select these, so
 * these are required again.
 */
export interface Table {
  id: number;
  restaurantId: string;
  number: string;
  name?: string | null;
  capacity: number;
  location?: string | null;
  floor?: number | null;
  section?: string | null;
  features?: TableFeatures | null;
  isActive: boolean;
  isOccupied: boolean;
  isReservable: boolean;
  occupiedBy?: string | null;
  occupiedAt?: Date | null;
  orderId?: number | null;
  currentOrderId?: string | null;
  estimatedReleaseTime?: Date | null;
  lastCleanedAt?: Date | null;
  cleaningNotes?: string | null;
  maintenanceNotes?: string | null;
  qrCode?: string | null;
  qrCodeVersion?: number | null;
  pendingQrCode?: string | null;
  pendingQrCodeVersion?: number | null;
  pendingQrPreparedAt?: Date | null;
  qrMode?: "table" | "seat" | null;
  /** `tables.total_usage`; returned by every read path but previously unlisted. */
  totalUsage?: number;
  seatCount?: number | null;
  seatNumberingStyle?: "numeric" | "alphabetic" | "custom" | null;
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
  options?: import("@makanmasak/database").QRCodeOptions;
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
export type { PaginatedResponse as PaginationResult } from "@makanmasak/shared-types";

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
