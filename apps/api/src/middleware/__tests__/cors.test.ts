/**
 * CORS Middleware Tests
 * CORS 中間件測試
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { corsMiddleware } from '../cors'
import { mockEnv } from '../../__tests__/setup'

describe('CORS Middleware', () => {
  let app: Hono<{ Bindings: typeof mockEnv }>

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono<{ Bindings: typeof mockEnv }>()
    app.use('*', corsMiddleware)
    app.get('/test', (c) => c.json({ success: true }))
    app.post('/test', (c) => c.json({ success: true }))
  })

  describe('Allowed Origins', () => {
    const allowedOrigins = [
      'https://customer.makanmakan.app',
      'https://admin.makanmakan.app',
      'https://kitchen.makanmakan.app',
      'https://makanmakan.app',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
    ]

    allowedOrigins.forEach(origin => {
      it(`should allow origin: ${origin}`, async () => {
        const req = new Request('http://localhost/test', {
          headers: { 'Origin': origin },
        })

        const res = await app.request(req, { env: mockEnv } as any)
        
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin)
        expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
      })
    })

    it('should not set CORS headers for unauthorized origin', async () => {
      const req = new Request('http://localhost/test', {
        headers: { 'Origin': 'https://malicious-site.com' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('should handle request without Origin header', async () => {
      const req = new Request('http://localhost/test')

      const res = await app.request(req, { env: mockEnv } as any)
      
      expect(res.status).toBe(200)
      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    })
  })

  describe('Preflight Requests (OPTIONS)', () => {
    it('should handle OPTIONS preflight request', async () => {
      const req = new Request('http://localhost/test', {
        method: 'OPTIONS',
        headers: { 'Origin': 'http://localhost:3000' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      expect(res.status).toBe(204)
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('PUT')
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('DELETE')
    })

    it('should set allowed headers', async () => {
      const req = new Request('http://localhost/test', {
        method: 'OPTIONS',
        headers: { 'Origin': 'http://localhost:3000' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      const allowedHeaders = res.headers.get('Access-Control-Allow-Headers')
      expect(allowedHeaders).toContain('Content-Type')
      expect(allowedHeaders).toContain('Authorization')
      expect(allowedHeaders).toContain('X-CSRF-Token')
    })

    it('should set max age for preflight cache', async () => {
      const req = new Request('http://localhost/test', {
        method: 'OPTIONS',
        headers: { 'Origin': 'http://localhost:3000' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      expect(res.headers.get('Access-Control-Max-Age')).toBe('3600')
    })
  })

  describe('Security Headers', () => {
    it('should set X-Content-Type-Options', async () => {
      const req = new Request('http://localhost/test', {
        headers: { 'Origin': 'http://localhost:3000' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    })

    it('should set X-Frame-Options', async () => {
      const req = new Request('http://localhost/test', {
        headers: { 'Origin': 'http://localhost:3000' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      expect(res.headers.get('X-Frame-Options')).toBe('DENY')
    })

    it('should set X-XSS-Protection', async () => {
      const req = new Request('http://localhost/test', {
        headers: { 'Origin': 'http://localhost:3000' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block')
    })

    it('should set Referrer-Policy', async () => {
      const req = new Request('http://localhost/test', {
        headers: { 'Origin': 'http://localhost:3000' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })

    it('should set Permissions-Policy', async () => {
      const req = new Request('http://localhost/test', {
        headers: { 'Origin': 'http://localhost:3000' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      const permissionsPolicy = res.headers.get('Permissions-Policy')
      expect(permissionsPolicy).toContain('geolocation=()')
      expect(permissionsPolicy).toContain('camera=()')
    })

    it('should set Content-Security-Policy', async () => {
      const req = new Request('http://localhost/test', {
        headers: { 'Origin': 'http://localhost:3000' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      const csp = res.headers.get('Content-Security-Policy')
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("frame-ancestors 'none'")
    })

    it('should set Strict-Transport-Security', async () => {
      const req = new Request('http://localhost/test', {
        headers: { 'Origin': 'http://localhost:3000' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      const hsts = res.headers.get('Strict-Transport-Security')
      expect(hsts).toContain('max-age=31536000')
      expect(hsts).toContain('includeSubDomains')
    })
  })

  describe('Exposed Headers', () => {
    it('should expose custom headers to frontend', async () => {
      const req = new Request('http://localhost/test', {
        headers: { 'Origin': 'http://localhost:3000' },
      })

      const res = await app.request(req, { env: mockEnv } as any)
      
      const exposedHeaders = res.headers.get('Access-Control-Expose-Headers')
      expect(exposedHeaders).toContain('X-Token-Refresh-Recommended')
      expect(exposedHeaders).toContain('X-RateLimit-Remaining')
      expect(exposedHeaders).toContain('X-RateLimit-Reset')
    })
  })

  describe('Development Ports', () => {
    const devPorts = ['3000', '3001', '3002', '3003', '3004', '3005', '3006', '3007', '3008', '3009']

    devPorts.forEach(port => {
      it(`should allow localhost:${port}`, async () => {
        const req = new Request('http://localhost/test', {
          headers: { 'Origin': `http://localhost:${port}` },
        })

        const res = await app.request(req, { env: mockEnv } as any)
        
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe(`http://localhost:${port}`)
      })

      it(`should allow 127.0.0.1:${port}`, async () => {
        const req = new Request('http://localhost/test', {
          headers: { 'Origin': `http://127.0.0.1:${port}` },
        })

        const res = await app.request(req, { env: mockEnv } as any)
        
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe(`http://127.0.0.1:${port}`)
      })
    })
  })
})
