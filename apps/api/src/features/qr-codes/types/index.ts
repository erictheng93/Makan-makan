/**
 * QR Codes Types
 * TypeScript type definitions for the QR codes feature
 */

import type { BaseEntity } from "../../../shared/types";

// QR Code Style Configuration
export interface QRStyle {
  backgroundColor?: string;
  foregroundColor?: string;
  size?: number;
  errorCorrection?: "L" | "M" | "Q" | "H";
  cornerStyle?: "square" | "rounded" | "circle";
  dotStyle?: "square" | "rounded" | "circle";
  gradientType?: "none" | "linear" | "radial";
  gradientColors?: {
    start: string;
    end: string;
    direction?: number;
  };
  logo?: {
    url: string;
    size: number;
    borderRadius: number;
    margin: number;
  };
  border?: {
    width: number;
    color: string;
    style: "solid" | "dashed" | "dotted";
  };
  shadow?: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

// QR Code Metadata
export interface QRMetadata {
  title?: string;
  description?: string;
  createdBy?: string;
  version?: string;
}

// QR Code Generation Request
export interface GenerateQRRequest {
  content: string;
  format?: "png" | "svg" | "pdf" | "jpeg";
  style?: QRStyle;
  metadata?: QRMetadata;
}

// Bulk QR Generation Request
export interface BulkQRRequest {
  tables: Array<{
    id: number;
    name: string;
    content: string;
    customStyle?: QRStyle;
  }>;
  defaultStyle?: QRStyle;
  format?: "png" | "svg" | "pdf" | "zip";
  includeMetadata?: boolean;
  pdfSettings?: {
    layout?: "grid" | "list";
    itemsPerPage?: number;
    pageSize?: "A4" | "A3" | "Letter";
    includeTableInfo?: boolean;
  };
}

// QR Code Template
export interface QRTemplate extends BaseEntity {
  name: string;
  description: string;
  category: "modern" | "classic" | "colorful" | "minimalist" | "branded";
  style: QRStyle;
  isActive: boolean;
  usage_count?: number;
}

// Data transfer types
export interface CreateQRTemplateData {
  name: string;
  description: string;
  category: "modern" | "classic" | "colorful" | "minimalist" | "branded";
  style: QRStyle;
  /** User ID of the creator (injected from auth context) */
  createdBy?: string;
}

export interface UpdateQRTemplateData {
  name?: string;
  description?: string;
  category?: "modern" | "classic" | "colorful" | "minimalist" | "branded";
  style?: QRStyle;
  isActive?: boolean;
}

// QR Code Entity
export interface QRCodeEntity {
  id: string;
  content: string;
  format: string;
  style?: QRStyle;
  metadata?: QRMetadata;
  downloadUrl?: string;
  downloadCount: number;
  fileSize?: number;
  restaurantId?: string;
  userId?: string;
  batchId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// QR Code Batch
export interface QRBatchEntity extends BaseEntity {
  name: string;
  format: string;
  itemCount: number;
  downloadUrl?: string;
  downloadCount: number;
  totalFileSize: number;
  restaurantId?: string;
  userId?: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  errorMessage?: string;
  batchId?: string;
}

// Statistics
export interface QRStatistics {
  totalQRCodes: number;
  totalDownloads: number;
  totalTemplates: number;
  popularTemplates: Array<{
    id: number;
    name: string;
    usage_count: number;
  }>;
  formatDistribution: Record<string, number>;
  recentActivity: Array<{
    type: "generate" | "download" | "bulk";
    timestamp: string;
    count: number;
  }>;
}

export interface QRDownloadCaller {
  userRole: number;
  userRestaurantId?: string;
}

// Service interfaces
export interface IQRCodeService {
  generateQR(
    data: GenerateQRRequest,
    userId?: string,
    restaurantId?: string,
  ): Promise<QRCodeEntity>;
  generateBulkQR(
    data: BulkQRRequest,
    userId?: string,
    restaurantId?: string,
  ): Promise<QRBatchEntity>;
  downloadQR(
    id: string,
    caller?: QRDownloadCaller,
  ): Promise<{ data: Buffer; contentType: string; filename: string } | null>;
  downloadBatch(
    batchId: string,
    caller?: QRDownloadCaller,
  ): Promise<{ data: Buffer; contentType: string; filename: string } | null>;
  getStatistics(restaurantId?: string): Promise<QRStatistics>;
}

export interface IQRTemplateService {
  listTemplates(category?: string): Promise<QRTemplate[]>;
  getTemplate(id: number): Promise<QRTemplate | null>;
  createTemplate(data: CreateQRTemplateData): Promise<QRTemplate>;
  updateTemplate(
    id: number,
    data: UpdateQRTemplateData,
  ): Promise<QRTemplate | null>;
  deleteTemplate(id: number): Promise<boolean>;
}

// Event types
export type QRCodeEvent =
  | { type: "QR_GENERATED"; payload: QRCodeEntity }
  | { type: "QR_DOWNLOADED"; payload: { id: string; downloadCount: number } }
  | { type: "BATCH_CREATED"; payload: QRBatchEntity }
  | { type: "BATCH_COMPLETED"; payload: QRBatchEntity }
  | { type: "TEMPLATE_CREATED"; payload: QRTemplate }
  | { type: "TEMPLATE_UPDATED"; payload: QRTemplate }
  | { type: "TEMPLATE_DELETED"; payload: { id: number } };
