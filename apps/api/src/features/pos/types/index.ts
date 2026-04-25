/**
 * POS系統類型定義
 */

export interface CashRegister {
  id: string;
  name: string;
  location?: string;
  restaurantId: string;
  isActive: boolean;
  currentShiftId?: string;
  hardwareConfig: Record<string, unknown>;
  peripherals: Record<string, unknown>;
  settings: Record<string, unknown>;
  lastMaintenanceAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CashShift {
  id: string;
  registerId: string;
  operatorId: number;
  startAmount: number;
  endAmount?: number;
  expectedAmount: number;
  actualAmount?: number;
  differenceAmount: number;
  totalSales: number;
  totalRefunds: number;
  cashSales: number;
  cardSales: number;
  digitalSales: number;
  totalTransactions: number;
  startedAt: Date;
  endedAt?: Date;
  status: "active" | "closed" | "suspended";
  notes?: string;
  closingNotes?: string;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  registerId: string;
  type:
    | "sale"
    | "refund"
    | "cash_in"
    | "cash_out"
    | "count"
    | "opening"
    | "closing"
    | "adjustment"
    | "payout"
    | "deposit";
  amount: number;
  description?: string;
  referenceId?: number;
  referenceType?: string;
  paymentMethod?: string;
  denominationBreakdown: Record<string, number>;
  recordedBy: number;
  approvedBy?: number;
  approvalStatus: "pending" | "approved" | "rejected";
  receiptNumber?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Receipt {
  id: string;
  orderId: number;
  registerId: string;
  shiftId?: string;
  receiptNumber: string;
  receiptType: "customer" | "kitchen" | "merchant" | "duplicate";
  templateName: string;
  content: string;
  rawContent?: string;
  printStatus: "pending" | "printing" | "printed" | "failed" | "cancelled";
  printAttempts: number;
  printerName?: string;
  printerResponse?: string;
  printedAt?: Date;
  reprintedCount: number;
  lastReprintAt?: Date;
  createdAt: Date;
}

export interface Refund {
  id: string;
  originalOrderId: number;
  registerId: string;
  shiftId?: string;
  refundNumber: string;
  refundType: "full" | "partial" | "item" | "service";
  originalAmount: number;
  refundAmount: number;
  refundMethod: string;
  reasonCode: string;
  reasonDescription?: string;
  itemsRefunded: unknown[];
  processedBy: number;
  approvedBy?: number;
  customerSignature?: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  processedAt?: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
}

// Request/Response 類型
export interface CreateRegisterRequest {
  name: string;
  location?: string;
  restaurantId: string;
  hardwareConfig?: Record<string, unknown>;
  peripherals?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export interface StartShiftRequest {
  registerId: string;
  operatorId: number;
  startAmount: number;
  notes?: string;
}

export interface EndShiftRequest {
  actualAmount: number;
  closingNotes?: string;
}

export interface CashMovementRequest {
  type: "cash_in" | "cash_out" | "count" | "adjustment" | "payout" | "deposit";
  amount: number;
  description: string;
  denominationBreakdown?: Record<string, number>;
  referenceId?: number;
  referenceType?: string;
}

export interface PrintReceiptRequest {
  orderId: number;
  templateName?: string;
  receiptType?: "customer" | "kitchen" | "merchant";
  copies?: number;
}

export interface ProcessRefundRequest {
  originalOrderId: number;
  refundType: "full" | "partial" | "item" | "service";
  refundAmount: number;
  refundMethod: string;
  reasonCode: string;
  reasonDescription?: string;
  itemsRefunded?: unknown[];
  customerSignature?: string;
}
