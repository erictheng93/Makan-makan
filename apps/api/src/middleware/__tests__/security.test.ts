/**
 * Security Middleware Tests
 * 安全中間件測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import {
  securityHeadersMiddleware,
  requestIdMiddleware,
  inputSanitizationMiddleware,
  securityMonitoringMiddleware,
  securityAwareRateLimitMiddleware,
} from '../security'
import { mockEnv } from '../../__tests__/setup'

describe('Security Headers Middleware', () => {
  let app: Hono<{ Bindings: typeof mockEnv }>

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono<{ Bindings: typeof mockEnv }>()
    app.use('*', async (c, next) => {
      // Ensure env is properly initialized
      if (!c.env) (c as any).env = {}
      Object.assign(c.env, { ...mockEnv, NODE_ENV: 'test' })
      await next()
    })
    app.use('*', securityHeadersMiddleware)
    app.get('/test', (c) => c.json({ success: true }))
  })

  it('should set X-Content-Type-Options header', async () => {
    const req = new Request('http://localhost/test')
    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('should set X-Frame-Options header', async () => {
    const req = new Request('http://localhost/test')
    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('should set X-XSS-Protection header', async () => {
    const req = new Request('http://localhost/test')
    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block')
  })

  it('should set Referrer-Policy header', async () => {
    const req = new Request('http://localhost/test')
    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('should set Permissions-Policy header', async () => {
    const req = new Request('http://localhost/test')
    const res = await app.request(req, { env: mockEnv } as any)
    
    const policy = res.headers.get('Permissions-Policy')
    expect(policy).toContain('geolocation=()')
    expect(policy).toContain('microphone=()')
    expect(policy).toContain('camera=()')
  })

  it('should set X-DNS-Prefetch-Control header', async () => {
    const req = new Request('http://localhost/test')
    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.headers.get('X-DNS-Prefetch-Control')).toBe('off')
  })

  it('should set X-Download-Options header', async () => {
    const req = new Request('http://localhost/test')
    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.headers.get('X-Download-Options')).toBe('noopen')
  })

  it('should set X-Permitted-Cross-Domain-Policies header', async () => {
    const req = new Request('http://localhost/test')
    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none')
  })

  it('should set Content-Security-Policy header', async () => {
    const req = new Request('http://localhost/test')
    const res = await app.request(req, { env: mockEnv } as any)
    
    const csp = res.headers.get('Content-Security-Policy')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('should handle auth endpoints', async () => {
    app.get('/auth/login', (c) => c.json({ success: true }))
    
    const req = new Request('http://localhost/auth/login')
    const res = await app.request(req, { env: mockEnv } as any)
    
    // Auth endpoints should return 200
    expect(res.status).toBe(200)
  })

  it('should handle user endpoints', async () => {
    app.get('/users/profile', (c) => c.json({ success: true }))
    
    const req = new Request('http://localhost/users/profile')
    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.status).toBe(200)
  })

  it('should handle error responses', async () => {
    app.get('/error', (c) => c.json({ error: 'Not found' }, 404))
    
    const req = new Request('http://localhost/error')
    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.status).toBe(404)
  })
})

describe('Request ID Middleware', () => {
  let app: Hono<{ Bindings: typeof mockEnv }>

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono<{ Bindings: typeof mockEnv }>()
    app.use('*', async (c, next) => {
      Object.assign(c.env || {}, mockEnv)
      await next()
    })
    app.use('*', requestIdMiddleware)
    app.get('/test', (c) => c.json({ requestId: c.get('requestId') }))
  })

  it('should generate unique request ID', async () => {
    const req = new Request('http://localhost/test')
    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.headers.get('X-Request-ID')).toBeTruthy()
    expect(res.headers.get('X-Request-ID')).toMatch(/^[a-f0-9-]{36}$/)
  })

  it('should set request ID in context', async () => {
    const req = new Request('http://localhost/test')
    const res = await app.request(req, { env: mockEnv } as any)
    const result = await res.json() as any
    
    expect(result.requestId).toBeTruthy()
    expect(result.requestId).toMatch(/^[a-f0-9-]{36}$/)
  })

  it('should generate different IDs for different requests', async () => {
    const req1 = new Request('http://localhost/test')
    const req2 = new Request('http://localhost/test')
    
    const res1 = await app.request(req1, { env: mockEnv } as any)
    const res2 = await app.request(req2, { env: mockEnv } as any)
    
    expect(res1.headers.get('X-Request-ID')).not.toBe(res2.headers.get('X-Request-ID'))
  })
})

describe('Input Sanitization Middleware', () => {
  let app: Hono<{ Bindings: typeof mockEnv }>

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono<{ Bindings: typeof mockEnv }>()
    app.use('*', async (c, next) => {
      Object.assign(c.env || {}, mockEnv)
      await next()
    })
    app.use('*', inputSanitizationMiddleware)
    app.post('/test', async (c) => {
      const body = await c.req.json()
      return c.json(body)
    })
  })

  it('should sanitize script tags', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '<script>alert("xss")</script>' }),
    })

    const res = await app.request(req, { env: mockEnv } as any)
    const result = await res.json() as any
    
    expect(result.name).not.toContain('<script>')
  })

  it('should sanitize javascript: protocol', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'javascript:alert(1)' }),
    })

    const res = await app.request(req, { env: mockEnv } as any)
    const result = await res.json() as any
    
    expect(result.url).not.toContain('javascript:')
  })

  it('should sanitize event handlers', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: '<img onerror="alert(1)" src="x">' }),
    })

    const res = await app.request(req, { env: mockEnv } as any)
    const result = await res.json() as any
    
    expect(result.html).not.toContain('onerror')
  })

  it('should encode HTML entities', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '<div>test</div>' }),
    })

    const res = await app.request(req, { env: mockEnv } as any)
    const result = await res.json() as any
    
    expect(result.text).toContain('&lt;')
    expect(result.text).toContain('&gt;')
  })

  it('should handle nested objects', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: {
          name: '<script>alert(1)</script>',
          profile: {
            bio: 'javascript:void(0)',
          },
        },
      }),
    })

    const res = await app.request(req, { env: mockEnv } as any)
    const result = await res.json() as any
    
    expect(result.user.name).not.toContain('<script>')
    expect(result.user.profile.bio).not.toContain('javascript:')
  })

  it('should handle arrays', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: ['<script>1</script>', '<script>2</script>'],
      }),
    })

    const res = await app.request(req, { env: mockEnv } as any)
    const result = await res.json() as any
    
    result.items.forEach((item: string) => {
      expect(item).not.toContain('<script>')
    })
  })

  it('should preserve non-string values', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count: 42,
        active: true,
        data: null,
      }),
    })

    const res = await app.request(req, { env: mockEnv } as any)
    const result = await res.json() as any
    
    expect(result.count).toBe(42)
    expect(result.active).toBe(true)
    expect(result.data).toBeNull()
  })

  it('should skip non-JSON content types', async () => {
    const req = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: '<script>alert(1)</script>',
    })

    // Should not throw, just pass through
    const res = await app.request(req, { env: mockEnv } as any)
    expect(res.status).toBeDefined()
  })
})

describe('Security Monitoring Middleware', () => {
  let app: Hono<{ Bindings: typeof mockEnv }>
  let consoleSpy: any

  beforeEach(() => {
    vi.clearAllMocks()
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    app = new Hono<{ Bindings: typeof mockEnv }>()
    app.use('*', async (c, next) => {
      Object.assign(c.env || {}, mockEnv)
      await next()
    })
    app.use('*', securityMonitoringMiddleware)
    app.get('/test', (c) => c.json({ success: true }))
    app.get('/admin', (c) => c.json({ success: true }, 403))
    app.get('/wp-admin', (c) => c.json({ success: true }))
  })

  it('should log security events for 403 responses', async () => {
    const req = new Request('http://localhost/admin', {
      headers: { 'cf-connecting-ip': '192.168.1.1' },
    })

    await app.request(req, { env: mockEnv } as any)
    
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('should detect suspicious user agent length', async () => {
    const longUserAgent = 'A'.repeat(600)
    const req = new Request('http://localhost/test', {
      headers: {
        'cf-connecting-ip': '192.168.1.1',
        'User-Agent': longUserAgent,
      },
    })

    await app.request(req, { env: mockEnv } as any)
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[SECURITY]',
      expect.stringContaining('SUSPICIOUS_USER_AGENT_LENGTH')
    )
  })

  it('should detect suspicious path patterns', async () => {
    const req = new Request('http://localhost/wp-admin', {
      headers: { 'cf-connecting-ip': '192.168.1.1' },
    })

    await app.request(req, { env: mockEnv } as any)
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[SECURITY]',
      expect.stringContaining('SUSPICIOUS_PATH_PATTERN')
    )
  })

  it('should pass through normal requests', async () => {
    const req = new Request('http://localhost/test', {
      headers: { 'cf-connecting-ip': '192.168.1.1' },
    })

    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.status).toBe(200)
  })
})

describe('Security Aware Rate Limit Middleware', () => {
  let app: Hono<{ Bindings: typeof mockEnv }>

  beforeEach(() => {
    vi.clearAllMocks()
    mockEnv.CACHE_KV.get.mockResolvedValue(null)
    mockEnv.CACHE_KV.put.mockResolvedValue(undefined)
    
    app = new Hono<{ Bindings: typeof mockEnv }>()
    app.use('*', async (c, next) => {
      // Ensure CACHE_KV is properly set
      if (!c.env) (c as any).env = {}
      c.env.CACHE_KV = mockEnv.CACHE_KV
      Object.assign(c.env, mockEnv)
      await next()
    })
    app.use('*', securityAwareRateLimitMiddleware)
    app.get('/test', (c) => c.json({ success: true }))
    app.get('/auth/login', (c) => c.json({ success: true }))
    app.get('/admin/users', (c) => c.json({ success: true }))
  })

  it('should skip rate limiting for localhost', async () => {
    mockEnv.CACHE_KV.get.mockResolvedValue('1000') // Way over limit

    const req = new Request('http://localhost/test', {
      headers: { 'cf-connecting-ip': '127.0.0.1' },
    })

    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.status).toBe(200)
  })

  it('should apply stricter limits for auth endpoints', async () => {
    mockEnv.CACHE_KV.get.mockResolvedValue('10') // At strict limit

    const req = new Request('http://localhost/auth/login', {
      headers: { 'cf-connecting-ip': '10.0.0.80' },
    })

    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.status).toBe(429)
  })

  it('should apply stricter limits for admin endpoints', async () => {
    mockEnv.CACHE_KV.get.mockResolvedValue('10') // At strict limit

    const req = new Request('http://localhost/admin/users', {
      headers: { 'cf-connecting-ip': '10.0.0.81' },
    })

    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.status).toBe(429)
  })

  it('should allow more requests for regular endpoints', async () => {
    mockEnv.CACHE_KV.get.mockResolvedValue('50') // Under regular limit (100)

    const req = new Request('http://localhost/test', {
      headers: { 'cf-connecting-ip': '10.0.0.82' },
    })

    const res = await app.request(req, { env: mockEnv } as any)
    
    expect(res.status).toBe(200)
  })
})
