import { BaseEntity } from './common';

export interface Table extends BaseEntity {
  restaurantId: string;
  tableNumber: number;
  tableName?: string;
  capacity: number;
  qrCode: string;
  status: TableStatus;
}

export enum TableStatus {
  AVAILABLE = 0,
  OCCUPIED = 1,
  RESERVED = 2,
  OUT_OF_ORDER = 3
}

export interface CreateTableRequest {
  restaurantId: string;
  tableNumber: number;
  tableName?: string;
  capacity?: number;
}

export interface UpdateTableRequest extends Partial<CreateTableRequest> {
  status?: TableStatus;
}

export interface BulkCreateTablesRequest {
  restaurantId: string;
  startNumber: number;
  endNumber: number;
  prefix?: string;
  capacity?: number;
}

export interface TableQRCodeRequest {
  restaurantId: string;
  tableId: number;
  size?: number;
  format?: 'png' | 'svg';
  logoUrl?: string;
}

export interface TableSession {
  tableId: number;
  restaurantId: string;
  sessionId: string;
  customerCount?: number;
  startTime: string;
  endTime?: string;
  status: 'active' | 'completed';
}