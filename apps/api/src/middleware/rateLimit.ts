import { Context, Next } from 'hono'
import type { Env } from '../types/env'

interface RateLimitOptions {
  windowMs: number
  maxRequests: number
  keyGenerator?: (c: Context) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

const defaultOptions: RateLimitOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  keyGenerator: (c) => c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown',
  skipSuccessfulRequests: false,
  skipFailedRequests: false
}

export function rateLimitMiddleware(options: Partial<RateLimitOptions> = {}) {
  const opts = { ...defaultOptions, ...options }
  
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const key = opts.keyGenerator!(c)
    const now = Date.now()
    const _windowStart = now - opts.windowMs
    
    // Generate rate limit key
    const rateLimitKey = `rate_limit:${key}:${Math.floor(now / opts.windowMs)}`
    
    try {
      // Get current count from KV store
      const currentCount = await c.env.CACHE_KV?.get(rateLimitKey)
      const count = currentCount ? parseInt(currentCount) : 0
      
      if (count >= opts.maxRequests) {
        return c.json({
          success: false,
          error: 'Too many requests',
          message: `Rate limit exceeded. Max ${opts.maxRequests} requests per ${opts.windowMs / 1000} seconds`,
          retryAfter: Math.ceil(opts.windowMs / 1000)
        }, 429, {
          'Retry-After': Math.ceil(opts.windowMs / 1000).toString(),
          'X-RateLimit-Limit': opts.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (now + (opts.windowMs - (now % opts.windowMs))).toString()
        })
      }
      
      // Execute request
      await next()
      
      // Only increment if we should count this request
      const shouldCount = (
        (!opts.skipSuccessfulRequests || c.res.status >= 400) &&
        (!opts.skipFailedRequests || c.res.status < 400)
      )
      
      if (shouldCount && c.env.CACHE_KV) {
        // Increment counter
        const newCount = count + 1
        const ttl = Math.ceil(opts.windowMs / 1000)
        await c.env.CACHE_KV.put(rateLimitKey, newCount.toString(), { expirationTtl: ttl })
        
        // Add rate limit headers
        c.res.headers.set('X-RateLimit-Limit', opts.maxRequests.toString())
        c.res.headers.set('X-RateLimit-Remaining', Math.max(0, opts.maxRequests - newCount).toString())
        c.res.headers.set('X-RateLimit-Reset', (now + (opts.windowMs - (now % opts.windowMs))).toString())
      }
      
    } catch (error) {
      console.error('Rate limiting error:', error)
      // Continue request if rate limiting fails
      await next()
    }
  }
}

// Preset configurations for different endpoints
export const strictRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5 // Very strict for sensitive operations
})

export const authRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 20 // Login attempts
})

export const apiRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000 // General API calls
})

export const publicRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 500 // Public endpoints (QR codes, health checks)
})