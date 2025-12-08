/**
 * Seats Feature Types
 * Type definitions for seat management
 */

export type NumberingStyle = 'numeric' | 'alphabetic' | 'custom';

export interface BatchCreateSeatsInput {
  tableId: number;
  seatCount: number;
  numberingStyle?: NumberingStyle;
  customNumbers?: string[];
  prefix?: string;
}

export interface UpdateSeatInput {
  seatNumber?: string;
  seatName?: string;
  position?: string;
  isActive?: boolean;
}

export interface OccupySeatInput {
  orderId: number;
  occupiedBy?: string;
}

export interface SeatFilters {
  tableId: number;
  isOccupied?: boolean;
  isActive?: boolean;
  seatNumbers?: string[];
  page?: number;
  limit?: number;
}

export interface Seat {
  id: number;
  tableId: number;
  tableNumber?: string;
  restaurantId?: number;
  restaurantName?: string;
  seatNumber: string;
  seatName?: string;
  position?: string;
  isActive: boolean;
  isOccupied: boolean;
  currentOrderId?: number;
  occupiedBy?: string;
  qrCode?: string;
  capacity?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SeatStats {
  tableId: number;
  totalSeats: number;
  activeSeats: number;
  occupiedSeats: number;
  availableSeats: number;
}

export interface PaginatedSeatsResult {
  seats: Seat[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface QRCodeResult {
  success: boolean;
  qrCode?: string;
  error?: string;
}

export interface BatchQRCodeResult {
  success: boolean;
  qrCodes?: Array<{ seatId: number; qrCode: string }>;
  error?: string;
}
