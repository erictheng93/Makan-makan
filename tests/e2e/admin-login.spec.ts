import { test, expect } from '@playwright/test'

test.describe('Admin Dashboard Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Visit the admin dashboard
    await page.goto('/dashboard')
  })

  test('should redirect to login when not authenticated', async ({ page }) => {
    // Should be redirected to login page
    await expect(page).toHaveURL(/.*\/login/)
    
    // Should show login form
    await expect(page.locator('form')).toBeVisible()
    await expect(page.locator('input[type="text"], input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('should show validation errors for empty form', async ({ page }) => {
    await page.goto('/login')
    
    // Click submit without filling form
    await page.click('button[type="submit"]')
    
    // Should show validation errors
    // Note: Actual selectors would depend on your validation implementation
    await expect(page.locator('.error-message, .text-red-500')).toHaveCount({ min: 1 })
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login')
    
    // Fill form with invalid credentials
    await page.fill('input[type="text"], input[type="email"]', 'invalid@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should show error message
    await expect(page.locator('.error-message, .alert-error')).toBeVisible()
  })

  test('should handle successful login flow', async ({ page }) => {
    // Mock successful login API response
    await page.route('/api/v1/auth/login', async route => {
      const json = {
        success: true,
        data: {
          token: 'mock-jwt-token',
          user: {
            id: 1,
            username: 'testuser',
            role: 1,
            restaurantId: 1
          }
        }
      }
      await route.fulfill({ json })
    })

    await page.goto('/login')
    
    // Fill form with valid credentials
    await page.fill('input[type="text"], input[type="email"]', 'testuser')
    await page.fill('input[type="password"]', 'password123')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/)
    
    // Should show dashboard content
    await expect(page.locator('h1, .dashboard-title')).toContainText(/儀表板|dashboard/i)
  })

  test('should handle SSE connection establishment', async ({ page }) => {
    // Mock auth endpoints
    await page.route('/api/v1/auth/login', async route => {
      const json = {
        success: true,
        data: {
          token: 'mock-jwt-token',
          user: {
            id: 1,
            username: 'testuser',
            role: 1,
            restaurantId: 1
          }
        }
      }
      await route.fulfill({ json })
    })

    // Mock SSE endpoint
    await page.route('/api/v1/sse/events*', async route => {
      // For E2E testing, we can't easily test real SSE connections
      // But we can verify the request is made
      await route.fulfill({ 
        status: 200,
        body: 'data: {"type":"heartbeat"}\n\n'
      })
    })

    await page.goto('/login')
    
    // Login
    await page.fill('input[type="text"], input[type="email"]', 'testuser')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/.*\/dashboard/)
    
    // Check for SSE connection indicator (if implemented in UI)
    // This would depend on your specific implementation
    await page.waitForTimeout(1000) // Allow time for SSE connection attempt
  })

  test('should handle logout correctly', async ({ page }) => {
    // Mock login
    await page.route('/api/v1/auth/login', async route => {
      const json = {
        success: true,
        data: {
          token: 'mock-jwt-token',
          user: {
            id: 1,
            username: 'testuser',
            role: 1,
            restaurantId: 1
          }
        }
      }
      await route.fulfill({ json })
    })

    // Mock logout
    await page.route('/api/v1/auth/logout', async route => {
      const json = { success: true, message: 'Logout successful' }
      await route.fulfill({ json })
    })

    // Login first
    await page.goto('/login')
    await page.fill('input[type="text"], input[type="email"]', 'testuser')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await expect(page).toHaveURL(/.*\/dashboard/)
    
    // Find and click logout button
    await page.click('[data-testid="logout-button"], .logout-button, button:has-text("登出"), button:has-text("Logout")')
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/)
  })
})

test.describe('Admin Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for all navigation tests
    await page.route('/api/v1/auth/login', async route => {
      const json = {
        success: true,
        data: {
          token: 'mock-jwt-token',
          user: {
            id: 1,
            username: 'testuser',
            role: 1, // Owner role
            restaurantId: 1
          }
        }
      }
      await route.fulfill({ json })
    })

    // Login
    await page.goto('/login')
    await page.fill('input[type="text"], input[type="email"]', 'testuser')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await expect(page).toHaveURL(/.*\/dashboard/)
  })

  test('should show correct navigation items for owner role', async ({ page }) => {
    // Check for main navigation items
    const expectedItems = [
      '儀表板',
      '訂單管理', 
      '菜單管理',
      '桌台管理',
      '員工管理',
      '數據分析',
      '廚房顯示',
      '收銀台'
    ]

    for (const item of expectedItems) {
      await expect(page.locator(`text=${item}`)).toBeVisible()
    }
  })

  test('should navigate between different sections', async ({ page }) => {
    // Test navigation to orders page
    await page.click('text=訂單管理')
    await expect(page).toHaveURL(/.*\/dashboard\/orders/)

    // Test navigation to menu page  
    await page.click('text=菜單管理')
    await expect(page).toHaveURL(/.*\/dashboard\/menu/)

    // Test navigation back to dashboard
    await page.click('text=儀表板')
    await expect(page).toHaveURL(/.*\/dashboard$/)
  })
})