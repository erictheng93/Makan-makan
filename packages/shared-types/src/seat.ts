/**
 * 座位管理系統類型定義
 * 支持一桌一碼和一位一碼兩種模式
 */

// ============================================
// 基礎類型
// ============================================

/**
 * QR 碼管理模式
 */
export type QRMode = "table" | "seat";

/**
 * 座位編號風格
 */
export type SeatNumberingStyle = "numeric" | "alphabetic" | "custom";

/**
 * 座位布局配置
 */
export interface SeatLayoutConfig {
  rows?: number;
  columns?: number;
  positions?: Array<{
    seatNumber: string;
    x: number;
    y: number;
  }>;
}

// ============================================
// 座位實體類型
// ============================================

/**
 * 座位基本資訊
 */
export interface Seat {
  id: number;
  tableId: number;
  seatNumber: string;
  seatName?: string;
  position?: string;

  // QR Code 資訊
  qrCode: string;
  qrCodeImageUrl?: string;
  qrCodeVersion: number;
  pendingQrCode?: string | null;
  pendingQrCodeVersion?: number | null;
  pendingQrPreparedAt?: Date | string | null;

  // 狀態
  isOccupied: boolean;
  isActive: boolean;
  currentOrderId?: number;

  // 追蹤資訊
  occupiedAt?: Date | string;
  occupiedBy?: string;
  totalUsage: number;

  // 時間戳
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * 座位詳細資訊（包含關聯的桌子和餐廳資訊）
 */
export interface SeatWithDetails extends Seat {
  tableName?: string;
  tableNumber: string;
  restaurantId: string;
  restaurantName: string;
}

// ============================================
// 請求/響應類型
// ============================================

/**
 * 創建座位請求
 */
export interface CreateSeatRequest {
  tableId: number;
  seatNumber: string;
  seatName?: string;
  position?: string;
}

/**
 * 批量創建座位請求
 */
export interface BatchCreateSeatsRequest {
  tableId: number;
  seatCount: number;
  numberingStyle: SeatNumberingStyle;
  prefix?: string;
  customNumbers?: string[];
}

/**
 * 更新座位請求
 */
export interface UpdateSeatRequest {
  seatNumber?: string;
  seatName?: string;
  position?: string;
  isActive?: boolean;
}

/**
 * 佔用座位請求
 */
export interface OccupySeatRequest {
  orderId: number;
  occupiedBy?: string;
}

/**
 * 切換 QR 模式請求
 */
export interface SwitchQRModeRequest {
  newMode: QRMode;
  seatConfig?: {
    count: number;
    numberingStyle: SeatNumberingStyle;
    prefix?: string;
  };
}

// ============================================
// 篩選和查詢類型
// ============================================

/**
 * 座位查詢篩選條件
 */
export interface SeatFilters {
  tableId?: number;
  isOccupied?: boolean;
  isActive?: boolean;
  seatNumbers?: string[];
}

/**
 * 座位查詢選項
 */
export interface SeatQueryOptions extends SeatFilters {
  page?: number;
  limit?: number;
  sortBy?: "seatNumber" | "totalUsage" | "createdAt";
  sortOrder?: "asc" | "desc";
}

// ============================================
// 統計類型
// ============================================

/**
 * 座位統計資訊
 */
export interface SeatStats {
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  inactiveSeats: number;
  averageOccupancyRate: number;
  totalUsage: number;
  averageUsagePerSeat: number;
}

/**
 * 座位使用熱度圖
 */
export interface SeatHeatMapData {
  seatId: number;
  seatNumber: string;
  totalUsage: number;
  averageOccupancyMinutes: number;
  averageOrderAmount: number;
  popularityScore: number;
}

/**
 * 桌子座位摘要
 */
export interface TableSeatSummary {
  tableId: number;
  tableNumber: string;
  qrMode: QRMode;
  configuredSeatCount: number;
  actualSeatCount: number;
  occupiedSeats: number;
  availableSeats: number;
  occupancyRate: number;
}

// ============================================
// API 響應類型
// ============================================

/**
 * 座位列表響應
 */
export interface SeatListResponse {
  success: boolean;
  data: Seat[];
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    totalItems: number;
  };
}

/**
 * 單個座位響應
 */
export interface SeatResponse {
  success: boolean;
  data: Seat;
}

/**
 * 批量生成 QR 碼響應
 */
export interface BatchQRGenerationResponse {
  success: boolean;
  data: Array<{
    seatId: number;
    seatNumber: string;
    qrCode: string;
    qrCodeImageUrl?: string;
  }>;
  batchId?: string;
}

/**
 * 座位統計響應
 */
export interface SeatStatsResponse {
  success: boolean;
  data: SeatStats;
}

/**
 * 模式切換響應
 */
export interface SwitchModeResponse {
  success: boolean;
  message?: string;
  data?: {
    tableId: number;
    oldMode: QRMode;
    newMode: QRMode;
    seatsCreated?: number;
    seatsDeleted?: number;
  };
}

// ============================================
// 錯誤類型
// ============================================

/**
 * 座位管理錯誤代碼
 */
export enum SeatErrorCode {
  SEAT_NOT_FOUND = "SEAT_NOT_FOUND",
  SEAT_OCCUPIED = "SEAT_OCCUPIED",
  SEAT_INACTIVE = "SEAT_INACTIVE",
  DUPLICATE_SEAT_NUMBER = "DUPLICATE_SEAT_NUMBER",
  INVALID_SEAT_COUNT = "INVALID_SEAT_COUNT",
  MODE_SWITCH_BLOCKED = "MODE_SWITCH_BLOCKED",
  TABLE_NOT_FOUND = "TABLE_NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
}

/**
 * 座位錯誤
 */
export interface SeatError {
  code: SeatErrorCode;
  message: string;
  details?: unknown;
}
