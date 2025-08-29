export interface Env {
  // Cloudflare bindings
  IMAGES_BUCKET: R2Bucket
  IMAGE_CACHE: KVNamespace
  DB: D1Database
  
  // Cloudflare Images API
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_IMAGES_API_TOKEN: string
  
  // Environment variables
  NODE_ENV: 'development' | 'staging' | 'production'
  API_VERSION: string
  
  // Image processing configuration
  IMAGE_API_BASE_URL: string
  MAX_IMAGE_SIZE_MB: string
  ALLOWED_MIME_TYPES: string
  
  // Image variants
  DEFAULT_VARIANTS: string
  THUMBNAIL_SIZE: string
  SMALL_SIZE: string
  MEDIUM_SIZE: string
  LARGE_SIZE: string
  
  // Security settings
  MAX_UPLOADS_PER_MINUTE: string
  MAX_TRANSFORMS_PER_MINUTE: string
  
  // JWT secret for authentication
  JWT_SECRET: string
  
  // Slack webhook for notifications
  SLACK_WEBHOOK_URL?: string
}

export interface ImageUploadRequest {
  file: File
  filename: string
  variants?: string[]
  metadata?: Record<string, any>
  restaurantId?: number
  category?: string
}

export interface ImageProcessRequest {
  imageId: string
  transformations?: ImageTransformation[]
  variants?: string[]
  format?: 'webp' | 'jpeg' | 'png' | 'avif'
  quality?: number
}

export interface ImageTransformation {
  type: 'resize' | 'crop' | 'rotate' | 'blur' | 'brighten' | 'sharpen'
  width?: number
  height?: number
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
  gravity?: 'auto' | 'center' | 'top' | 'bottom' | 'left' | 'right'
  angle?: number
  radius?: number
  sigma?: number
  amount?: number
  background?: string
}

export interface ImageVariant {
  name: string
  width: number
  height: number
  fit?: string
  format?: string
  quality?: number
}

export interface ImageMetadata {
  id: string
  filename: string
  originalFilename: string
  mimeType: string
  size: number
  width?: number
  height?: number
  variants: Record<string, string> // variant name -> URL
  uploadedAt: string
  uploadedBy?: number
  restaurantId?: number
  category?: string
  tags?: string[]
  altText?: string
  caption?: string
  exifData?: Record<string, any>
}

export interface CloudflareImagesResponse {
  success: boolean
  errors: Array<{
    code: number
    message: string
  }>
  messages: string[]
  result?: {
    id: string
    filename: string
    uploaded: string
    requireSignedURLs: boolean
    variants: string[]
  }
}

export interface ImageProcessingJob {
  id: string
  imageId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  transformations: ImageTransformation[]
  variants: string[]
  createdAt: string
  completedAt?: string
  error?: string
  progress?: number
}

export interface ImageAnalytics {
  totalImages: number
  totalSize: number
  avgProcessingTime: number
  mostUsedVariants: Array<{ variant: string; count: number }>
  uploadsByCategory: Array<{ category: string; count: number }>
  errorRate: number
  storageUsage: {
    original: number
    variants: number
    total: number
  }
}