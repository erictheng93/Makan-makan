/**
 * Image Compression Service
 *
 * Handles image optimization, compression, and variant generation
 * using Cloudflare Images API and custom processing
 */

export interface ImageVariant {
  name: string
  width?: number
  height?: number
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'
  quality?: number
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
}

export interface CompressionResult {
  originalSize: number
  compressedSize: number
  compressionRatio: number
  variants: {
    [key: string]: {
      url: string
      size: number
      dimensions: { width: number; height: number }
    }
  }
  format: string
  duration: number
}

export interface CloudflareImagesConfig {
  accountId: string
  apiToken: string
  deliveryUrl: string
}

export class ImageCompressionService {
  private config: CloudflareImagesConfig

  // Predefined variants for menu items
  private readonly MENU_ITEM_VARIANTS: ImageVariant[] = [
    {
      name: 'thumbnail',
      width: 150,
      height: 150,
      fit: 'cover',
      quality: 80,
      format: 'auto'
    },
    {
      name: 'small',
      width: 320,
      height: 320,
      fit: 'scale-down',
      quality: 85,
      format: 'auto'
    },
    {
      name: 'medium',
      width: 640,
      height: 640,
      fit: 'scale-down',
      quality: 85,
      format: 'auto'
    },
    {
      name: 'large',
      width: 1280,
      height: 1280,
      fit: 'scale-down',
      quality: 90,
      format: 'auto'
    },
    {
      name: 'thumbnail-webp',
      width: 150,
      height: 150,
      fit: 'cover',
      quality: 80,
      format: 'webp'
    },
    {
      name: 'medium-webp',
      width: 640,
      height: 640,
      fit: 'scale-down',
      quality: 85,
      format: 'webp'
    }
  ]

  constructor(config: CloudflareImagesConfig) {
    this.config = config
  }

  /**
   * Upload and compress image to Cloudflare Images
   */
  async uploadAndCompress(
    imageBuffer: ArrayBuffer,
    metadata: {
      id?: string
      requireSignedURLs?: boolean
      metadata?: Record<string, string>
    } = {}
  ): Promise<{
    id: string
    filename: string
    uploaded: string
    requireSignedURLs: boolean
    variants: string[]
  }> {
    const formData = new FormData()
    formData.append('file', new Blob([imageBuffer]))

    if (metadata.requireSignedURLs) {
      formData.append('requireSignedURLs', 'true')
    }

    if (metadata.metadata) {
      formData.append('metadata', JSON.stringify(metadata.metadata))
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`
        },
        body: formData
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.statusText}`)
    }

    const result = await response.json()
    return result.result
  }

  /**
   * Generate multiple variants for a menu item image
   */
  async generateMenuItemVariants(
    imageId: string
  ): Promise<Record<string, string>> {
    const variants: Record<string, string> = {}

    for (const variant of this.MENU_ITEM_VARIANTS) {
      const url = this.generateVariantUrl(imageId, variant)
      variants[variant.name] = url
    }

    return variants
  }

  /**
   * Generate variant URL with transformation parameters
   */
  private generateVariantUrl(imageId: string, variant: ImageVariant): string {
    const params: string[] = []

    if (variant.width) params.push(`w=${variant.width}`)
    if (variant.height) params.push(`h=${variant.height}`)
    if (variant.quality) params.push(`q=${variant.quality}`)
    if (variant.format) params.push(`f=${variant.format}`)
    if (variant.fit) params.push(`fit=${variant.fit}`)

    const variantName = params.length > 0 ? params.join(',') : 'public'
    return `${this.config.deliveryUrl}/${imageId}/${variantName}`
  }

  /**
   * Optimize image with custom compression
   * Falls back to manual compression if Cloudflare Images not available
   */
  async optimizeImage(
    imageBuffer: ArrayBuffer,
    options: {
      maxWidth?: number
      maxHeight?: number
      quality?: number
      format?: 'jpeg' | 'png' | 'webp'
    } = {}
  ): Promise<ArrayBuffer> {
    const {
      maxWidth = 1920,
      maxHeight = 1920,
      quality = 85,
      format = 'jpeg'
    } = options

    // Note: In a real implementation, you would use a library like sharp or imagemagick
    // For Cloudflare Workers, we rely on Cloudflare Images API
    // This is a placeholder for custom compression logic

    console.log('Image optimization requested:', {
      maxWidth,
      maxHeight,
      quality,
      format
    })

    return imageBuffer
  }

  /**
   * Calculate compression metrics
   */
  async analyzeCompression(
    originalBuffer: ArrayBuffer,
    compressedBuffer: ArrayBuffer
  ): Promise<{
    originalSize: number
    compressedSize: number
    compressionRatio: number
    savings: number
    savingsPercentage: number
  }> {
    const originalSize = originalBuffer.byteLength
    const compressedSize = compressedBuffer.byteLength
    const savings = originalSize - compressedSize
    const savingsPercentage = (savings / originalSize) * 100
    const compressionRatio = originalSize / compressedSize

    return {
      originalSize,
      compressedSize,
      compressionRatio,
      savings,
      savingsPercentage
    }
  }

  /**
   * Delete image from Cloudflare Images
   */
  async deleteImage(imageId: string): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/images/v1/${imageId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to delete image: ${response.statusText}`)
    }
  }

  /**
   * Batch upload multiple images
   */
  async batchUpload(
    images: Array<{
      buffer: ArrayBuffer
      metadata?: Record<string, string>
    }>,
    options: {
      concurrency?: number
      onProgress?: (current: number, total: number) => void
    } = {}
  ): Promise<Array<{ id: string; url: string }>> {
    const { concurrency = 3, onProgress } = options
    const results: Array<{ id: string; url: string }> = []
    const batches: typeof images[] = []

    // Split into batches
    for (let i = 0; i < images.length; i += concurrency) {
      batches.push(images.slice(i, i + concurrency))
    }

    // Process batches sequentially
    let processed = 0
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (image) => {
          const result = await this.uploadAndCompress(image.buffer, {
            metadata: image.metadata
          })
          return {
            id: result.id,
            url: `${this.config.deliveryUrl}/${result.id}/public`
          }
        })
      )

      results.push(...batchResults)
      processed += batch.length

      if (onProgress) {
        onProgress(processed, images.length)
      }
    }

    return results
  }

  /**
   * Get image metadata from Cloudflare Images
   */
  async getImageMetadata(imageId: string): Promise<{
    id: string
    filename: string
    uploaded: string
    requireSignedURLs: boolean
    variants: string[]
    meta?: Record<string, string>
  }> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/images/v1/${imageId}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch image metadata: ${response.statusText}`)
    }

    const result = await response.json()
    return result.result
  }

  /**
   * Generate responsive srcset for an image
   */
  generateResponsiveSrcset(
    imageId: string,
    sizes: number[] = [320, 640, 960, 1280, 1920]
  ): string {
    return sizes
      .map((width) => {
        const url = this.generateVariantUrl(imageId, {
          name: `w${width}`,
          width,
          fit: 'scale-down',
          quality: 85,
          format: 'auto'
        })
        return `${url} ${width}w`
      })
      .join(', ')
  }

  /**
   * Validate image before upload
   */
  validateImage(
    buffer: ArrayBuffer,
    options: {
      maxSize?: number // in bytes
      allowedFormats?: string[]
    } = {}
  ): {
    valid: boolean
    error?: string
  } {
    const { maxSize = 10 * 1024 * 1024, allowedFormats = ['image/jpeg', 'image/png', 'image/webp'] } = options

    if (buffer.byteLength > maxSize) {
      return {
        valid: false,
        error: `Image size (${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(2)}MB)`
      }
    }

    // Basic format validation (check magic numbers)
    const arr = new Uint8Array(buffer)
    const header = Array.from(arr.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const formatSignatures: Record<string, string> = {
      'ffd8ffe': 'image/jpeg',
      '89504e47': 'image/png',
      '52494646': 'image/webp'
    }

    const detectedFormat = Object.entries(formatSignatures).find(([sig]) =>
      header.startsWith(sig)
    )?.[1]

    if (!detectedFormat || !allowedFormats.includes(detectedFormat)) {
      return {
        valid: false,
        error: `Unsupported image format. Allowed formats: ${allowedFormats.join(', ')}`
      }
    }

    return { valid: true }
  }
}
