/**
 * Percy Visual Regression Tests
 *
 * Captures snapshots of key pages and components for visual comparison
 */

import { test } from '@playwright/test'
import percySnapshot from '@percy/playwright'

/**
 * Helper function to wait for app to be fully loaded
 */
async function waitForAppLoad(page: any) {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle')

  // Wait for any animations to complete
  await page.waitForTimeout(500)
}

/**
 * Helper function to login as different roles
 */
async function loginAs(page: any, role: 'admin' | 'owner' | 'chef' | 'cashier') {
  const credentials = {
    admin: { username: 'admin', password: 'admin123' },
    owner: { username: 'owner', password: 'owner123' },
    chef: { username: 'chef', password: 'chef123' },
    cashier: { username: 'cashier', password: 'cashier123' },
  }

  await page.goto('/login')
  await page.fill('input[name="username"]', credentials[role].username)
  await page.fill('input[name="password"]', credentials[role].password)
  await page.click('button[type="submit"]')
  await waitForAppLoad(page)
}

test.describe('Visual Regression Tests - Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin')
  })

  test('Dashboard Home Page', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Admin Dashboard - Home', {
      widths: [375, 768, 1440],
    })
  })

  test('Menu Management Page', async ({ page }) => {
    await page.goto('/dashboard/menu')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Admin Dashboard - Menu Management', {
      widths: [768, 1440],
    })
  })

  test('Menu Management - Add Item Modal', async ({ page }) => {
    await page.goto('/dashboard/menu')
    await waitForAppLoad(page)

    // Open add item modal
    await page.click('button:has-text("新增")')
    await page.waitForSelector('.modal:visible')

    // Capture snapshot
    await percySnapshot(page, 'Admin Dashboard - Add Menu Item Modal', {
      widths: [768, 1440],
    })
  })

  test('Orders Management Page', async ({ page }) => {
    await page.goto('/dashboard/orders')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Admin Dashboard - Orders Management', {
      widths: [768, 1440],
    })
  })

  test('Orders Management - Filters Applied', async ({ page }) => {
    await page.goto('/dashboard/orders')
    await waitForAppLoad(page)

    // Apply filters
    const statusFilter = page.locator('select[name="status"]').first()
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('pending')
      await page.waitForTimeout(500)
    }

    // Capture snapshot
    await percySnapshot(page, 'Admin Dashboard - Orders Filtered', {
      widths: [768, 1440],
    })
  })

  test('Tables Management Page', async ({ page }) => {
    await page.goto('/dashboard/tables')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Admin Dashboard - Tables Management', {
      widths: [768, 1440],
    })
  })

  test('Users Management Page', async ({ page }) => {
    await page.goto('/dashboard/users')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Admin Dashboard - Users Management', {
      widths: [768, 1440],
    })
  })

  test('Analytics Page', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Admin Dashboard - Analytics', {
      widths: [768, 1440],
    })
  })

  test('Settings Page', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Admin Dashboard - Settings', {
      widths: [768, 1440],
    })
  })
})

test.describe('Visual Regression Tests - Customer App', () => {
  test('Menu Browsing Page', async ({ page }) => {
    await page.goto('/menu')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Customer App - Menu', {
      widths: [375, 768, 1024],
    })
  })

  test('Menu Item Detail Modal', async ({ page }) => {
    await page.goto('/menu')
    await waitForAppLoad(page)

    // Click on first menu item
    const firstItem = page.locator('.menu-item').first()
    if (await firstItem.isVisible()) {
      await firstItem.click()
      await page.waitForSelector('.modal:visible')

      // Capture snapshot
      await percySnapshot(page, 'Customer App - Menu Item Detail', {
        widths: [375, 768],
      })
    }
  })

  test('Shopping Cart', async ({ page }) => {
    await page.goto('/cart')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Customer App - Shopping Cart', {
      widths: [375, 768, 1024],
    })
  })

  test('Order Confirmation', async ({ page }) => {
    await page.goto('/order-confirmation')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Customer App - Order Confirmation', {
      widths: [375, 768],
    })
  })
})

test.describe('Visual Regression Tests - Kitchen Display', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'chef')
  })

  test('Kitchen Display - Order Queue', async ({ page }) => {
    await page.goto('/kitchen')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Kitchen Display - Order Queue', {
      widths: [1024, 1440, 1920],
    })
  })

  test('Kitchen Display - Order Details', async ({ page }) => {
    await page.goto('/kitchen')
    await waitForAppLoad(page)

    // Click on first order
    const firstOrder = page.locator('.order-card').first()
    if (await firstOrder.isVisible()) {
      await firstOrder.click()
      await page.waitForTimeout(300)

      // Capture snapshot
      await percySnapshot(page, 'Kitchen Display - Order Details', {
        widths: [1024, 1440],
      })
    }
  })
})

test.describe('Visual Regression Tests - Responsive Design', () => {
  test('Mobile Navigation Menu', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')
    await waitForAppLoad(page)

    // Open mobile menu
    const menuButton = page.locator('button[aria-label="Menu"]').first()
    if (await menuButton.isVisible()) {
      await menuButton.click()
      await page.waitForTimeout(300)

      // Capture snapshot
      await percySnapshot(page, 'Mobile Navigation - Open', {
        widths: [375],
      })
    }
  })

  test('Tablet Layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/dashboard')
    await waitForAppLoad(page)

    // Capture snapshot
    await percySnapshot(page, 'Dashboard - Tablet Layout', {
      widths: [768],
    })
  })
})

test.describe('Visual Regression Tests - Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Enable dark mode
    await page.goto('/dashboard')
    await waitForAppLoad(page)

    // Toggle dark mode (adjust selector based on your implementation)
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]').first()
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click()
      await page.waitForTimeout(300)
    }
  })

  test('Dashboard - Dark Mode', async ({ page }) => {
    await percySnapshot(page, 'Dashboard - Dark Mode', {
      widths: [768, 1440],
    })
  })

  test('Menu Management - Dark Mode', async ({ page }) => {
    await page.goto('/dashboard/menu')
    await waitForAppLoad(page)

    await percySnapshot(page, 'Menu Management - Dark Mode', {
      widths: [768, 1440],
    })
  })
})

test.describe('Visual Regression Tests - Error States', () => {
  test('404 Page', async ({ page }) => {
    await page.goto('/non-existent-page')
    await waitForAppLoad(page)

    await percySnapshot(page, 'Error - 404 Page', {
      widths: [375, 768, 1440],
    })
  })

  test('Empty State - No Orders', async ({ page }) => {
    await loginAs(page, 'admin')
    await page.goto('/dashboard/orders')
    await waitForAppLoad(page)

    // Mock empty state (you may need to adjust this based on your implementation)
    await page.evaluate(() => {
      // Clear orders list
      const ordersList = document.querySelector('[data-testid="orders-list"]')
      if (ordersList) {
        ordersList.innerHTML = '<div class="empty-state">暫無訂單</div>'
      }
    })

    await percySnapshot(page, 'Empty State - No Orders', {
      widths: [768, 1440],
    })
  })
})
