import { Hono } from 'hono'
import { z } from 'zod'
import { CloudflareImagesAPI, ImageUtils } from '../utils/cloudflare-images'
import { ImageService } from '../services/image-service'
import { 
  authMiddleware, 
  optionalAuth, 
  requireRole, 
  checkImageAccess, 
  uploadRateLimit,
  transformRateLimit,
  checkFileSize 
} from '../middleware/auth'
import { 
  validateQuery, 
  validateParams, 
  validateBody,
  validateFileType,
  securityScan,
  imageSchemas 
} from '../middleware/validation'
import type { Env, ImageMetadata } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

/**
 * Upload image
 * POST /images/upload
 */
app.post('/upload',
  authMiddleware,
  (c, next) => uploadRateLimit(c.env)(c, next),
  (c, next) => checkFileSize(parseInt(c.env.MAX_IMAGE_SIZE_MB) || 10)(c, next),
  (c, next) => validateFileType(c.env.ALLOWED_MIME_TYPES.split(','))(c, next),
  securityScan,
  validateQuery(imageSchemas.uploadParams),
  async (c) => {
    try {
      const user = c.get('user')
      const file = c.get('file') as File
      const query = c.get('validatedQuery')
      
      if (!file) {
        return c.json({
          success: false,
          error: 'No file provided'
        }, 400)
      }

      const cloudflareImages = new CloudflareImagesAPI(c.env)
      const imageService = new ImageService(c.env)

      // Generate unique filename
      const uniqueFilename = ImageUtils.generateUniqueFilename(file.name)
      
      // Parse tags if provided
      const tags = query.tags ? query.tags.split(',').map((tag: string) => tag.trim()) : undefined

      // Upload to Cloudflare Images
      const uploadResult = await cloudflareImages.uploadImage(file, {
        filename: uniqueFilename,
        metadata: {
          originalName: file.name,
          uploadedBy: user.id.toString(),
          restaurantId: query.restaurantId?.toString() || '',
          category: query.category || 'general'
        }
      })

      if (!uploadResult.success) {
        return c.json({
          success: false,
          error: uploadResult.error || 'Upload failed'
        }, 500)
      }

      // Extract image metadata (basic implementation)
      const imageMetadata = await cloudflareImages.extractImageMetadata(file)

      // Generate variants
      const accountHash = c.env.CLOUDFLARE_ACCOUNT_ID // You'll need this from Cloudflare
      const variants = cloudflareImages.generateImageVariants(
        uploadResult.result.id,
        accountHash
      )

      // Save metadata to database
      const metadata: Omit<ImageMetadata, 'id'> = {
        filename: uniqueFilename,
        originalFilename: file.name,
        mimeType: file.type,
        size: file.size,
        width: imageMetadata.width,
        height: imageMetadata.height,
        variants,
        uploadedAt: new Date().toISOString(),
        uploadedBy: user.id,
        restaurantId: query.restaurantId,
        category: query.category,
        tags,
        altText: query.altText,
        caption: query.caption,
        exifData: imageMetadata.exif
      }

      const saveResult = await imageService.saveImageMetadata(metadata)

      if (!saveResult.success) {
        // Try to delete the uploaded image if metadata save fails
        await cloudflareImages.deleteImage(uploadResult.result.id)
        
        return c.json({
          success: false,
          error: saveResult.error || 'Failed to save metadata'
        }, 500)
      }

      // Record upload in analytics
      c.executionCtx.waitUntil(
        imageService.recordImageView(saveResult.id!, 'upload')
      )

      return c.json({
        success: true,
        data: {
          id: saveResult.id,
          filename: uniqueFilename,
          originalFilename: file.name,
          size: file.size,
          variants,
          uploadedAt: metadata.uploadedAt
        }
      }, 201)

    } catch (error) {
      console.error('Image upload error:', error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }, 500)
    }
  }
)

/**
 * Get image metadata
 * GET /images/:imageId
 */
app.get('/:imageId',
  optionalAuth,
  validateParams(imageSchemas.imageIdParam),
  checkImageAccess,
  async (c) => {
    try {
      const { imageId } = c.get('validatedParams')
      const imageService = new ImageService(c.env)

      const result = await imageService.getImageMetadata(imageId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error || 'Image not found'
        }, 404)
      }

      // Record view for analytics
      c.executionCtx.waitUntil(
        imageService.recordImageView(imageId, 'metadata')
      )

      return c.json({
        success: true,
        data: result.data
      })

    } catch (error) {
      console.error('Get image metadata error:', error)
      return c.json({
        success: false,
        error: 'Failed to get image metadata'
      }, 500)
    }
  }
)

/**
 * Update image metadata
 * PUT /images/:imageId
 */
app.put('/:imageId',
  authMiddleware,
  requireRole([0, 1, 2]), // Admin, Owner, Chef
  validateParams(imageSchemas.imageIdParam),
  validateBody(imageSchemas.updateBody),
  checkImageAccess,
  async (c) => {
    try {
      const { imageId } = c.get('validatedParams')
      const updates = c.get('validatedBody')
      const imageService = new ImageService(c.env)

      const result = await imageService.updateImageMetadata(imageId, updates)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error || 'Failed to update image'
        }, 500)
      }

      return c.json({
        success: true,
        message: 'Image metadata updated successfully'
      })

    } catch (error) {
      console.error('Update image metadata error:', error)
      return c.json({
        success: false,
        error: 'Failed to update image metadata'
      }, 500)
    }
  }
)

/**
 * Delete image
 * DELETE /images/:imageId
 */
app.delete('/:imageId',
  authMiddleware,
  requireRole([0, 1, 2]), // Admin, Owner, Chef
  validateParams(imageSchemas.imageIdParam),
  checkImageAccess,
  async (c) => {
    try {
      const { imageId } = c.get('validatedParams')
      const cloudflareImages = new CloudflareImagesAPI(c.env)
      const imageService = new ImageService(c.env)

      // Delete from Cloudflare Images
      const deleteResult = await cloudflareImages.deleteImage(imageId)

      if (!deleteResult.success) {
        return c.json({
          success: false,
          error: deleteResult.error || 'Failed to delete image'
        }, 500)
      }

      // Delete metadata from database
      const metadataResult = await imageService.deleteImageMetadata(imageId)

      if (!metadataResult.success) {
        console.error('Failed to delete image metadata:', metadataResult.error)
        // Continue anyway since the image was deleted from Cloudflare
      }

      return c.json({
        success: true,
        message: 'Image deleted successfully'
      })

    } catch (error) {
      console.error('Delete image error:', error)
      return c.json({
        success: false,
        error: 'Failed to delete image'
      }, 500)
    }
  }
)

/**
 * List images
 * GET /images
 */
app.get('/',
  authMiddleware,
  validateQuery(imageSchemas.listQuery),
  async (c) => {
    try {
      const user = c.get('user')
      const query = c.get('validatedQuery')
      const imageService = new ImageService(c.env)

      // Apply access control
      let options = { ...query }
      
      // Non-admins can only see their restaurant's images
      if (user.role !== 0) {
        options.restaurantId = user.restaurantId
      }

      // Parse tags if provided
      if (query.tags) {
        options.tags = query.tags.split(',').map((tag: string) => tag.trim())
      }

      const result = await imageService.listImages(options)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error || 'Failed to list images'
        }, 500)
      }

      const { images, total } = result.data!

      return c.json({
        success: true,
        data: {
          images,
          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            pages: Math.ceil(total / query.limit)
          }
        }
      })

    } catch (error) {
      console.error('List images error:', error)
      return c.json({
        success: false,
        error: 'Failed to list images'
      }, 500)
    }
  }
)

/**
 * Get image (optimized delivery)
 * GET /images/:imageId/view
 */
app.get('/:imageId/view',
  optionalAuth,
  validateParams(imageSchemas.imageIdParam),
  validateQuery(imageSchemas.variantParams),
  checkImageAccess,
  async (c) => {
    try {
      const { imageId } = c.get('validatedParams')
      const { variant, width, height, fit, format, quality } = c.get('validatedQuery')
      const cloudflareImages = new CloudflareImagesAPI(c.env)
      const imageService = new ImageService(c.env)

      // Get image metadata
      const metadataResult = await imageService.getImageMetadata(imageId)

      if (!metadataResult.success) {
        return c.json({
          success: false,
          error: 'Image not found'
        }, 404)
      }

      const metadata = metadataResult.data!

      // Determine best format based on Accept header
      const acceptHeader = c.req.header('Accept') || ''
      const userAgent = c.req.header('User-Agent') || ''
      const optimalFormat = format || ImageUtils.getBestFormat(acceptHeader, userAgent)

      // Build transformation URL
      let imageUrl: string

      if (width || height || fit || format || quality) {
        // Custom transformations
        const transformations = []

        if (width || height) {
          transformations.push({
            type: 'resize' as const,
            width,
            height,
            fit: fit || 'scale-down'
          })
        }

        const accountHash = c.env.CLOUDFLARE_ACCOUNT_ID
        imageUrl = cloudflareImages.buildTransformationURL(
          imageId,
          accountHash,
          transformations
        )

        // Add format and quality parameters
        const params = []
        if (optimalFormat !== 'original') params.push(`format=${optimalFormat}`)
        if (quality) params.push(`quality=${quality}`)

        if (params.length > 0) {
          imageUrl += (imageUrl.includes('?') ? '&' : '?') + params.join('&')
        }
      } else {
        // Use predefined variant
        imageUrl = metadata.variants[variant] || metadata.variants.original
      }

      // Record view for analytics
      c.executionCtx.waitUntil(
        imageService.recordImageView(imageId, variant)
      )

      // Redirect to the optimized image URL
      return c.redirect(imageUrl, 302)

    } catch (error) {
      console.error('Image view error:', error)
      return c.json({
        success: false,
        error: 'Failed to serve image'
      }, 500)
    }
  }
)

/**
 * Process image with transformations
 * POST /images/:imageId/process
 */
app.post('/:imageId/process',
  authMiddleware,
  requireRole([0, 1, 2]), // Admin, Owner, Chef
  (c, next) => transformRateLimit(c.env)(c, next),
  validateParams(imageSchemas.imageIdParam),
  validateBody(imageSchemas.processParams),
  checkImageAccess,
  async (c) => {
    try {
      const { imageId } = c.get('validatedParams')
      const { transformations = [], variants = [], format, quality } = c.get('validatedBody')
      const cloudflareImages = new CloudflareImagesAPI(c.env)
      const imageService = new ImageService(c.env)

      // Create processing job
      const jobResult = await imageService.createProcessingJob(
        imageId,
        transformations,
        variants
      )

      if (!jobResult.success) {
        return c.json({
          success: false,
          error: jobResult.error || 'Failed to create processing job'
        }, 500)
      }

      const jobId = jobResult.jobId!

      // Start processing asynchronously
      c.executionCtx.waitUntil(
        processImageAsync(c.env, jobId, imageId, transformations, variants, format, quality)
      )

      return c.json({
        success: true,
        data: {
          jobId,
          status: 'pending',
          message: 'Image processing started'
        }
      }, 202)

    } catch (error) {
      console.error('Process image error:', error)
      return c.json({
        success: false,
        error: 'Failed to start image processing'
      }, 500)
    }
  }
)

/**
 * Get processing job status
 * GET /images/jobs/:jobId
 */
app.get('/jobs/:jobId',
  authMiddleware,
  validateParams(z.object({ jobId: z.string() })),
  async (c) => {
    try {
      const { jobId } = c.get('validatedParams')
      const imageService = new ImageService(c.env)

      const result = await imageService.getJobStatus(jobId)

      if (!result.success) {
        return c.json({
          success: false,
          error: result.error || 'Job not found'
        }, 404)
      }

      return c.json({
        success: true,
        data: result.job
      })

    } catch (error) {
      console.error('Get job status error:', error)
      return c.json({
        success: false,
        error: 'Failed to get job status'
      }, 500)
    }
  }
)

/**
 * Bulk operations on images
 * POST /images/bulk
 */
app.post('/bulk',
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner only
  validateBody(imageSchemas.bulkOperationBody),
  async (c) => {
    try {
      const user = c.get('user')
      const { imageIds, operation, data } = c.get('validatedBody')
      const imageService = new ImageService(c.env)
      const cloudflareImages = new CloudflareImagesAPI(c.env)

      const results = []

      for (const imageId of imageIds) {
        try {
          // Check access to each image
          const metadataResult = await imageService.getImageMetadata(imageId)
          
          if (!metadataResult.success) {
            results.push({ imageId, success: false, error: 'Image not found' })
            continue
          }

          const metadata = metadataResult.data!

          // Access control check
          if (user.role !== 0 && metadata.restaurantId !== user.restaurantId) {
            results.push({ imageId, success: false, error: 'Access denied' })
            continue
          }

          switch (operation) {
            case 'delete':
              const deleteResult = await cloudflareImages.deleteImage(imageId)
              if (deleteResult.success) {
                await imageService.deleteImageMetadata(imageId)
              }
              results.push({ imageId, success: deleteResult.success, error: deleteResult.error })
              break

            case 'update_category':
              if (data?.category) {
                const updateResult = await imageService.updateImageMetadata(imageId, { 
                  category: data.category 
                })
                results.push({ imageId, success: updateResult.success, error: updateResult.error })
              } else {
                results.push({ imageId, success: false, error: 'Category required' })
              }
              break

            case 'update_tags':
              if (data?.tags) {
                const updateResult = await imageService.updateImageMetadata(imageId, { 
                  tags: data.tags 
                })
                results.push({ imageId, success: updateResult.success, error: updateResult.error })
              } else {
                results.push({ imageId, success: false, error: 'Tags required' })
              }
              break

            case 'generate_variants':
              // This would trigger variant generation
              const jobResult = await imageService.createProcessingJob(imageId, [], ['all'])
              results.push({ imageId, success: jobResult.success, jobId: jobResult.jobId, error: jobResult.error })
              break

            default:
              results.push({ imageId, success: false, error: 'Unknown operation' })
          }
        } catch (error) {
          results.push({ 
            imageId, 
            success: false, 
            error: error instanceof Error ? error.message : 'Operation failed' 
          })
        }
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount

      return c.json({
        success: successCount > 0,
        data: {
          operation,
          processed: results.length,
          successful: successCount,
          failed: failCount,
          results
        }
      })

    } catch (error) {
      console.error('Bulk operation error:', error)
      return c.json({
        success: false,
        error: 'Bulk operation failed'
      }, 500)
    }
  }
)

// Helper function for async image processing
async function processImageAsync(
  env: Env,
  jobId: string,
  imageId: string,
  transformations: any[],
  variants: string[],
  format?: string,
  quality?: number
) {
  const imageService = new ImageService(env)
  const cloudflareImages = new CloudflareImagesAPI(env)

  try {
    await imageService.updateJobStatus(jobId, 'processing', 10)

    // Get image details
    const imageResult = await cloudflareImages.getImageDetails(imageId)
    
    if (!imageResult.success) {
      await imageService.updateJobStatus(jobId, 'failed', undefined, imageResult.error)
      return
    }

    await imageService.updateJobStatus(jobId, 'processing', 50)

    // Generate variants and transformations
    const accountHash = env.CLOUDFLARE_ACCOUNT_ID
    const newVariants = cloudflareImages.generateImageVariants(imageId, accountHash)

    // Apply custom transformations if specified
    if (transformations.length > 0) {
      for (const transform of transformations) {
        const transformUrl = cloudflareImages.buildTransformationURL(
          imageId,
          accountHash,
          [transform]
        )
        newVariants[`custom_${transform.type}`] = transformUrl
      }
    }

    await imageService.updateJobStatus(jobId, 'processing', 80)

    // Update image metadata with new variants
    await imageService.updateImageMetadata(imageId, { variants: newVariants })

    await imageService.updateJobStatus(jobId, 'completed', 100)

  } catch (error) {
    console.error('Async image processing error:', error)
    await imageService.updateJobStatus(
      jobId, 
      'failed', 
      undefined, 
      error instanceof Error ? error.message : 'Processing failed'
    )
  }
}

export default app