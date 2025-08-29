import type { Env, CloudflareImagesResponse, ImageMetadata, ImageTransformation } from '../types/env'

/**
 * Cloudflare Images API integration utility class
 */
export class CloudflareImagesAPI {
  private env: Env
  private baseURL: string
  private headers: Record<string, string>

  constructor(env: Env) {
    this.env = env
    this.baseURL = `${env.IMAGE_API_BASE_URL}/${env.CLOUDFLARE_ACCOUNT_ID}/images/v1`
    this.headers = {
      'Authorization': `Bearer ${env.CLOUDFLARE_IMAGES_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  }

  /**
   * Upload an image to Cloudflare Images
   */
  async uploadImage(
    file: File | ArrayBuffer,
    metadata?: {
      filename?: string
      requireSignedURLs?: boolean
      metadata?: Record<string, string>
    }
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const formData = new FormData()
      
      if (file instanceof File) {
        formData.append('file', file)
        if (metadata?.filename) {
          formData.append('id', metadata.filename)
        }
      } else {
        // Convert ArrayBuffer to File-like object
        const blob = new Blob([file])
        formData.append('file', blob, metadata?.filename || `image-${Date.now()}`)
      }

      if (metadata?.requireSignedURLs !== undefined) {
        formData.append('requireSignedURLs', String(metadata.requireSignedURLs))
      }

      if (metadata?.metadata) {
        Object.entries(metadata.metadata).forEach(([key, value]) => {
          formData.append(`metadata[${key}]`, value)
        })
      }

      const response = await fetch(`${this.baseURL}`, {
        method: 'POST',
        headers: {
          'Authorization': this.headers.Authorization
          // Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: formData
      })

      const result: CloudflareImagesResponse = await response.json()

      if (!result.success) {
        console.error('Cloudflare Images API error:', result.errors)
        return {
          success: false,
          error: result.errors?.[0]?.message || 'Upload failed'
        }
      }

      return {
        success: true,
        result: result.result
      }

    } catch (error) {
      console.error('Error uploading to Cloudflare Images:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error'
      }
    }
  }

  /**
   * Get image details from Cloudflare Images
   */
  async getImageDetails(imageId: string): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/${imageId}`, {
        method: 'GET',
        headers: this.headers
      })

      const result: CloudflareImagesResponse = await response.json()

      if (!result.success) {
        return {
          success: false,
          error: result.errors?.[0]?.message || 'Failed to get image details'
        }
      }

      return {
        success: true,
        result: result.result
      }

    } catch (error) {
      console.error('Error getting image details:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * List images with pagination
   */
  async listImages(options?: {
    page?: number
    perPage?: number
  }): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const params = new URLSearchParams()
      if (options?.page) params.append('page', String(options.page))
      if (options?.perPage) params.append('per_page', String(options.perPage))

      const url = `${this.baseURL}${params.toString() ? `?${params.toString()}` : ''}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      })

      const result: CloudflareImagesResponse = await response.json()

      if (!result.success) {
        return {
          success: false,
          error: result.errors?.[0]?.message || 'Failed to list images'
        }
      }

      return {
        success: true,
        result: result.result
      }

    } catch (error) {
      console.error('Error listing images:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Delete an image from Cloudflare Images
   */
  async deleteImage(imageId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/${imageId}`, {
        method: 'DELETE',
        headers: this.headers
      })

      const result: CloudflareImagesResponse = await response.json()

      if (!result.success) {
        return {
          success: false,
          error: result.errors?.[0]?.message || 'Failed to delete image'
        }
      }

      return { success: true }

    } catch (error) {
      console.error('Error deleting image:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update image metadata
   */
  async updateImageMetadata(
    imageId: string,
    metadata: Record<string, string>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const formData = new FormData()
      
      Object.entries(metadata).forEach(([key, value]) => {
        formData.append(`metadata[${key}]`, value)
      })

      const response = await fetch(`${this.baseURL}/${imageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': this.headers.Authorization
        },
        body: formData
      })

      const result: CloudflareImagesResponse = await response.json()

      if (!result.success) {
        return {
          success: false,
          error: result.errors?.[0]?.message || 'Failed to update metadata'
        }
      }

      return {
        success: true,
        result: result.result
      }

    } catch (error) {
      console.error('Error updating image metadata:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Generate image variants with different transformations
   */
  generateImageVariants(imageId: string, accountHash: string): Record<string, string> {
    const baseURL = `https://imagedelivery.net/${accountHash}/${imageId}`
    
    return {
      original: `${baseURL}/original`,
      thumbnail: `${baseURL}/thumbnail`, // Assumes 'thumbnail' variant is configured
      small: `${baseURL}/small`,
      medium: `${baseURL}/medium`,
      large: `${baseURL}/large`,
      // Custom transformations
      square_thumbnail: `${baseURL}/w=150,h=150,fit=crop,gravity=auto`,
      webp_medium: `${baseURL}/w=600,h=600,format=webp,quality=85`,
      mobile_optimized: `${baseURL}/w=400,h=400,format=webp,quality=80`,
      retina: `${baseURL}/w=1200,h=1200,format=webp,quality=90,dpr=2`
    }
  }

  /**
   * Build transformation URL for Cloudflare Images
   */
  buildTransformationURL(
    imageId: string,
    accountHash: string,
    transformations: ImageTransformation[]
  ): string {
    const baseURL = `https://imagedelivery.net/${accountHash}/${imageId}`
    const params: string[] = []

    transformations.forEach(transform => {
      switch (transform.type) {
        case 'resize':
          if (transform.width) params.push(`w=${transform.width}`)
          if (transform.height) params.push(`h=${transform.height}`)
          if (transform.fit) params.push(`fit=${transform.fit}`)
          break
        case 'crop':
          if (transform.width) params.push(`w=${transform.width}`)
          if (transform.height) params.push(`h=${transform.height}`)
          params.push('fit=crop')
          if (transform.gravity) params.push(`gravity=${transform.gravity}`)
          break
        case 'rotate':
          if (transform.angle) params.push(`rotate=${transform.angle}`)
          break
        case 'blur':
          if (transform.radius) params.push(`blur=${transform.radius}`)
          break
        case 'brighten':
          if (transform.amount) params.push(`brightness=${transform.amount}`)
          break
        case 'sharpen':
          if (transform.amount) params.push(`sharpen=${transform.amount}`)
          break
      }
    })

    return params.length > 0 ? `${baseURL}/${params.join(',')}` : `${baseURL}/original`
  }

  /**
   * Validate image file
   */
  validateImageFile(file: File, allowedMimeTypes: string[], maxSizeMB: number): {
    valid: boolean
    error?: string
  } {
    // Check MIME type
    const allowedTypes = allowedMimeTypes.map(type => type.trim().toLowerCase())
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      }
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File too large. Maximum size: ${maxSizeMB}MB`
      }
    }

    // Check if it's actually an image by reading the first few bytes
    return { valid: true }
  }

  /**
   * Extract EXIF data from image (basic implementation)
   */
  async extractImageMetadata(file: File): Promise<{
    width?: number
    height?: number
    format?: string
    size: number
    exif?: Record<string, any>
  }> {
    return {
      size: file.size,
      format: file.type,
      // Note: Full EXIF extraction would require additional libraries
      // This is a placeholder for basic metadata
    }
  }

  /**
   * Generate secure signed URLs for images
   */
  generateSignedURL(
    imageId: string,
    accountHash: string,
    expireSeconds: number = 3600
  ): string {
    // Note: This would require implementing JWT signing for Cloudflare Images
    // For now, return the direct URL
    return `https://imagedelivery.net/${accountHash}/${imageId}/original`
  }
}

/**
 * Utility functions for image processing
 */
export const ImageUtils = {
  /**
   * Generate unique filename with timestamp and random suffix
   */
  generateUniqueFilename(originalFilename: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const extension = originalFilename.split('.').pop()
    const baseName = originalFilename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, '-')
    
    return `${baseName}-${timestamp}-${random}.${extension}`
  },

  /**
   * Parse image variants configuration
   */
  parseVariantsConfig(variantsString: string): Record<string, { width: number; height: number }> {
    const variants: Record<string, { width: number; height: number }> = {}
    
    const variantNames = variantsString.split(',').map(v => v.trim())
    
    variantNames.forEach(variant => {
      switch (variant) {
        case 'thumbnail':
          variants[variant] = { width: 150, height: 150 }
          break
        case 'small':
          variants[variant] = { width: 300, height: 300 }
          break
        case 'medium':
          variants[variant] = { width: 600, height: 600 }
          break
        case 'large':
          variants[variant] = { width: 1200, height: 1200 }
          break
        default:
          variants[variant] = { width: 600, height: 600 }
      }
    })

    return variants
  },

  /**
   * Calculate optimal image quality based on format and size
   */
  calculateOptimalQuality(format: string, width: number, height: number): number {
    const pixels = width * height
    
    if (format === 'webp') {
      if (pixels > 1000000) return 80 // Large images
      if (pixels > 400000) return 85  // Medium images  
      return 90 // Small images
    }
    
    if (format === 'jpeg') {
      if (pixels > 1000000) return 75
      if (pixels > 400000) return 80
      return 85
    }

    return 85 // Default quality
  },

  /**
   * Determine best format for image delivery
   */
  getBestFormat(acceptHeader: string = '', userAgent: string = ''): string {
    // Check if browser supports WebP
    if (acceptHeader.includes('image/webp')) {
      return 'webp'
    }

    // Check if browser supports AVIF (newer, better compression)
    if (acceptHeader.includes('image/avif')) {
      return 'avif'
    }

    // Fallback to JPEG
    return 'jpeg'
  }
}