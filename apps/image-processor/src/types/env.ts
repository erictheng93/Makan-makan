import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export interface Env {
  // Cloudflare bindings
  IMAGE_CACHE: KVNamespace;
  DB: D1Database;
  IMAGES_BUCKET: R2Bucket;

  // Environment variables
  NODE_ENV: "development" | "production";
  API_VERSION: string;
  CORS_ORIGIN?: string;

  // Image processing configuration
  IMAGE_API_BASE_URL: string;
  MAX_IMAGE_SIZE_MB: string;
  ALLOWED_MIME_TYPES: string;

  // Image variants
  DEFAULT_VARIANTS: string;
  THUMBNAIL_SIZE: string;
  SMALL_SIZE: string;
  MEDIUM_SIZE: string;
  LARGE_SIZE: string;

  // Security settings
  MAX_UPLOADS_PER_MINUTE: string;
  MAX_TRANSFORMS_PER_MINUTE: string;

  // JWT secret for authentication
  JWT_SECRET: string;

  // Token blacklist KV namespace (optional, for invalidating tokens)
  TOKEN_BLACKLIST?: KVNamespace;

  // API key for authentication
  API_KEY?: string;

  // Slack webhook for notifications
  SLACK_WEBHOOK_URL?: string;
}

export interface ImageUploadRequest {
  file: File;
  filename: string;
  variants?: string[];
  metadata?: Record<string, unknown>;
  restaurantId?: string;
  category?: string;
}

export interface ImageProcessRequest {
  imageId: string;
  transformations?: ImageTransformation[];
  variants?: string[];
  format?: "webp" | "jpeg" | "png" | "avif";
  quality?: number;
}

export interface ImageTransformation {
  type: "resize" | "crop" | "rotate" | "blur" | "brighten" | "sharpen";
  width?: number;
  height?: number;
  fit?: "scale-down" | "contain" | "cover" | "crop" | "pad";
  gravity?: "auto" | "center" | "top" | "bottom" | "left" | "right";
  angle?: number;
  radius?: number;
  sigma?: number;
  amount?: number;
  background?: string;
}

export interface ImageVariant {
  name: string;
  width: number;
  height: number;
  fit?: string;
  format?: string;
  quality?: number;
}

export interface ImageMetadata {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  variants: Record<string, string>; // variant name -> URL
  uploadedAt: string;
  uploadedBy?: string;
  restaurantId?: string;
  category?: string;
  tags?: string[];
  altText?: string;
  caption?: string;
  exifData?: Record<string, unknown>;
}

export interface StoredImageObject {
  id: string;
  key: string;
  variant: string;
  uploaded: string;
}

export interface ImageProcessingJob {
  id: string;
  imageId: string;
  status: "pending" | "processing" | "completed" | "failed";
  transformations: ImageTransformation[];
  variants: string[];
  createdAt: string;
  completedAt?: string;
  error?: string;
  progress?: number;
}

export interface ImageAnalytics {
  totalImages: number;
  totalSize: number;
  avgProcessingTime: number;
  mostUsedVariants: Array<{ variant: string; count: number }>;
  uploadsByCategory: Array<{ category: string; count: number }>;
  errorRate: number;
  storageUsage: {
    original: number;
    variants: number;
    total: number;
  };
}
