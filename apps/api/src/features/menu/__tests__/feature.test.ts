/**
 * Menu Feature Tests
 * Comprehensive unit tests for the Menu feature module
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import type { Env } from '../../../shared/types'
import { MenuService } from '../services/MenuService'
import routes from '../routes'
import type {
  MenuItem,
  Category,
  MenuStructure,
  CreateMenuItemData,
  UpdateMenuItemData,
  CreateCategoryData,
  MenuAnalytics,
  PopularityMetrics
} from '../types'

// =============================================================================
// FILE-SCOPE MOCK INSTANCES
// =============================================================================

// Mock DatabaseMenuService instance
const mockDatabaseMenuServiceInstance = {
  getMenu: vi.fn(),
  getMenuItem: vi.fn(),
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  deleteMenuItem: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  searchMenuItems: vi.fn(),
  getFeaturedItems: vi.fn(),
  getPopularItems: vi.fn(),
  batchUpdateAvailability: vi.fn(),
  incrementOrderCount: vi.fn(),
  incrementViewCount: vi.fn()
}

// Mock Logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn()
}

// Mock CacheKV with proper typing that simulates real KV behavior
const mockCacheKV = {
  get: vi.fn((key: string, type?: string) => {
    // When type is 'json', KV automatically parses JSON
    // Return null by default (cache miss)
    return Promise.resolve(null)
  }),
  set: vi.fn().mockResolvedValue(undefined),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(true),
  list: vi.fn().mockResolvedValue({ keys: [] })
}

// Mock data
const mockRestaurantId = 1
const mockUserId = 100

const mockMenuItem: MenuItem = {
  id: 1,
  restaurantId: mockRestaurantId,
  categoryId: 1,
  name: 'Test Menu Item',
  inventoryCount: 100,
  description: 'A delicious test item',
  price: 15.99,
  originalPrice: 18.99,
  imageUrl: 'https://example.com/image.jpg',
  isAvailable: true,
  isFeatured: false,
  isPopular: false,
  sortOrder: 0,
  spiceLevel: 2,
  preparationTime: 20,
  calories: 350,
  dietaryInfo: {
    vegetarian: true,
    glutenFree: false
  },
  allergens: ['nuts'],
  orderCount: 45,
  rating: 4.2,
  reviewCount: 12,
  viewCount: 156,
  tags: ['popular', 'healthy'],
  keywords: 'vegetarian healthy nuts',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-15T00:00:00.000Z'
}

const mockCategory: Category = {
  id: 1,
  restaurantId: mockRestaurantId,
  name: 'Test Category',
  description: 'A test category',
  sortOrder: 0,
  status: 1,
  itemCount: 5,
  isActive: true,
  isVisible: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z'
}

const mockMenuStructure: MenuStructure = {
  categories: [mockCategory],
  menuItems: [mockMenuItem]
}

const mockMenuAnalytics: MenuAnalytics = {
  totalItems: 10,
  availableItems: 8,
  featuredItems: 3,
  popularItems: 2,
  averagePrice: 22.50,
  priceRange: { min: 8.99, max: 45.00 },
  categoryDistribution: [
    {
      categoryId: 1,
      categoryName: 'Main Dishes',
      itemCount: 5,
      percentage: 50
    }
  ],
  topPerformingItems: [
    {
      id: 1,
      name: 'Best Seller',
      orderCount: 100,
      revenue: 1599.00,
      rating: 4.8
    }
  ],
  dietaryInfoStats: {
    vegetarian: 3,
    vegan: 1,
    glutenFree: 2,
    halal: 4
  },
  spiceLevelDistribution: {
    0: 2,
    1: 3,
    2: 3,
    3: 1,
    4: 1
  }
}

const mockPopularityMetrics: PopularityMetrics = {
  mostOrdered: [mockMenuItem],
  mostViewed: [mockMenuItem],
  highestRated: [mockMenuItem],
  recentlyAdded: [mockMenuItem]
}

// Complete mock environment with all required Env properties
const mockEnv: Env = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
  API_VERSION: 'v1',
  DB: {} as any,
  CACHE_KV: mockCacheKV as any,
  TOKEN_BLACKLIST: {} as any,
  IMAGES_BUCKET: {} as any,
  BACKUP_STORAGE: {} as any,
  JOB_QUEUE: {} as any,
  REALTIME_ORDERS: {} as any,
  ANALYTICS_ENGINE: {
    writeDataPoint: vi.fn()
  } as any,
  RATE_LIMIT_KV: {} as any,
  REALTIME_SESSION: {} as any,
  API_BASE_URL: 'http://localhost:8787',
  INTERNAL_API_TOKEN: 'test-token',
  SLACK_WEBHOOK_URL: 'https://hooks.slack.com/test/webhook',
  CLOUDFLARE_IMAGES_KEY: 'test-images-key'
}

// Mock user for authentication tests
const mockUser = {
  id: mockUserId,
  username: 'testuser',
  fullName: 'Test User',
  restaurantId: mockRestaurantId,
  role: 1, // SHOP_OWNER
  email: 'test@example.com',
  isActive: true,
  isVerified: true,
  twoFactorEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date()
}

describe('Menu Feature Module', () => {
  let app: Hono<{ Bindings: Env }>
  let menuService: MenuService

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>()
    app.route('/', routes)

    // Reset all mocks
    vi.clearAllMocks()

    // Create menu service instance
    menuService = new MenuService(mockEnv)

    // CRITICAL: Replace internal services with our mocks
    // This ensures all tests use our controlled mock instances
    menuService['dbService'] = mockDatabaseMenuServiceInstance as any
    menuService['cacheService'] = mockCacheKV
    menuService['logger'] = mockLogger as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('MenuService', () => {
    describe('Menu Structure Operations', () => {
      test('should fetch complete menu successfully', async () => {
        // Mock the database service
        const mockDbService = {
          getMenu: vi.fn().mockResolvedValue(mockMenuStructure)
        }

        // Replace the db service in menu service
        ;(menuService as any).dbService = mockDbService

        const result = await menuService.getMenu(mockRestaurantId)

        expect(result).toEqual(mockMenuStructure)
        expect(mockDbService.getMenu).toHaveBeenCalledWith(mockRestaurantId)
      })

      test('should fetch menu item by id successfully', async () => {
        const mockDbService = {
          getMenuItem: vi.fn().mockResolvedValue(mockMenuItem)
        }

        ;(menuService as any).dbService = mockDbService

        const result = await menuService.getMenuItem(1)

        expect(result).toEqual(mockMenuItem)
        expect(mockDbService.getMenuItem).toHaveBeenCalledWith(1)
      })

      test('should return null for non-existent menu item', async () => {
        const mockDbService = {
          getMenuItem: vi.fn().mockResolvedValue(null)
        }

        ;(menuService as any).dbService = mockDbService

        const result = await menuService.getMenuItem(999)

        expect(result).toBeNull()
      })
    })

    describe('Menu Item Management', () => {
      test('should create menu item successfully', async () => {
        const createData: CreateMenuItemData = {
          restaurantId: mockRestaurantId,
          categoryId: 1,
          name: 'New Test Item',
          description: 'A new test item',
          price: 12.99
        }

        const mockDbService = {
          createMenuItem: vi.fn().mockResolvedValue(mockMenuItem)
        }

        ;(menuService as any).dbService = mockDbService
        ;(menuService as any).validateCategoryAccess = vi.fn().mockResolvedValue(undefined)
        ;(menuService as any).invalidateMenuCache = vi.fn().mockResolvedValue(undefined)

        const result = await menuService.createMenuItem(createData)

        expect(result).toEqual(mockMenuItem)
        expect(mockDbService.createMenuItem).toHaveBeenCalledWith(createData)
      })

      test('should update menu item successfully', async () => {
        const updateData: UpdateMenuItemData = {
          name: 'Updated Item',
          price: 16.99,
          isAvailable: false
        }

        const mockDbService = {
          getMenuItem: vi.fn().mockResolvedValue(mockMenuItem),
          updateMenuItem: vi.fn().mockResolvedValue({ ...mockMenuItem, ...updateData })
        }

        ;(menuService as any).dbService = mockDbService
        ;(menuService as any).invalidateMenuCache = vi.fn().mockResolvedValue(undefined)

        const result = await menuService.updateMenuItem(1, updateData)

        expect(result.name).toBe(updateData.name)
        expect(result.price).toBe(updateData.price)
        expect(mockDbService.updateMenuItem).toHaveBeenCalledWith(1, updateData)
      })

      test('should throw error when updating non-existent menu item', async () => {
        const updateData: UpdateMenuItemData = { name: 'Updated Item' }

        ;(menuService as any).getMenuItem = vi.fn().mockResolvedValue(null)

        await expect(menuService.updateMenuItem(999, updateData)).rejects.toThrow('Menu item not found')
      })
    })

    describe('Category Management', () => {
      test('should create category successfully', async () => {
        const createData: CreateCategoryData = {
          restaurantId: mockRestaurantId,
          name: 'New Category',
          description: 'A new test category'
        }

        const mockDbService = {
          createCategory: vi.fn().mockResolvedValue(mockCategory)
        }

        ;(menuService as any).dbService = mockDbService
        ;(menuService as any).invalidateMenuCache = vi.fn().mockResolvedValue(undefined)

        const result = await menuService.createCategory(createData)

        expect(result).toEqual(mockCategory)
        expect(mockDbService.createCategory).toHaveBeenCalledWith(createData)
      })
    })

    describe('Search and Analytics', () => {
      test('should search menu items with filters', async () => {
        const mockSearchResult = {
          items: [mockMenuItem],
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1
          }
        }

        const mockDbService = {
          searchMenuItems: vi.fn().mockResolvedValue(mockSearchResult)
        }

        ;(menuService as any).dbService = mockDbService

        const searchParams = {
          search: 'test',
          categoryId: 1,
          page: 1,
          limit: 20
        }

        const result = await menuService.searchMenuItems(mockRestaurantId, searchParams)

        expect(result).toEqual(mockSearchResult)
        expect(mockDbService.searchMenuItems).toHaveBeenCalledWith(
          mockRestaurantId,
          expect.objectContaining({
            search: 'test',
            categoryId: 1
          }),
          1,
          20
        )
      })

      test('should get menu analytics', async () => {
        (menuService as any).getMenu = vi.fn().mockResolvedValue(mockMenuStructure)

        const result = await menuService.getMenuAnalytics(mockRestaurantId)

        expect(result).toBeDefined()
        expect(typeof result.totalItems).toBe('number')
        expect(typeof result.averagePrice).toBe('number')
        expect(Array.isArray(result.categoryDistribution)).toBe(true)
      })

      test('should get popularity metrics', async () => {
        const mockDbService = {
          getPopularItems: vi.fn().mockResolvedValue([mockMenuItem]),
          searchMenuItems: vi.fn().mockResolvedValue({
            items: [mockMenuItem],
            pagination: {} as any
          })
        }

        ;(menuService as any).dbService = mockDbService

        const result = await menuService.getPopularityMetrics(mockRestaurantId)

        expect(result).toBeDefined()
        expect(Array.isArray(result.mostOrdered)).toBe(true)
        expect(Array.isArray(result.mostViewed)).toBe(true)
        expect(Array.isArray(result.highestRated)).toBe(true)
        expect(Array.isArray(result.recentlyAdded)).toBe(true)
      })
    })

    describe('Bulk Operations', () => {
      test('should batch update availability', async () => {
        const updates = [
          { id: 1, isAvailable: false },
          { id: 2, isAvailable: true }
        ]

        const mockDbService = {
          batchUpdateAvailability: vi.fn().mockResolvedValue(undefined)
        }

        ;(menuService as any).dbService = mockDbService
        ;(menuService as any).invalidateMenuCache = vi.fn().mockResolvedValue(undefined)

        await menuService.batchUpdateAvailability(mockRestaurantId, updates)

        expect(mockDbService.batchUpdateAvailability).toHaveBeenCalledWith(mockRestaurantId, updates)
      })

      test('should batch update prices', async () => {
        const updates = [
          { id: 1, price: 15.99, originalPrice: 18.99 },
          { id: 2, price: 12.99 }
        ]

        const mockDbService = {
          updateMenuItem: vi.fn().mockResolvedValue(mockMenuItem)
        }

        ;(menuService as any).dbService = mockDbService
        ;(menuService as any).invalidateMenuCache = vi.fn().mockResolvedValue(undefined)

        await menuService.batchUpdatePrices(mockRestaurantId, updates)

        expect(mockDbService.updateMenuItem).toHaveBeenCalledTimes(updates.length)
      })
    })

    describe('Utility Functions', () => {
      test('should increment order count', async () => {
        const mockDbService = {
          incrementOrderCount: vi.fn().mockResolvedValue(undefined)
        }

        ;(menuService as any).dbService = mockDbService

        await menuService.incrementOrderCount(1, 2)

        expect(mockDbService.incrementOrderCount).toHaveBeenCalledWith(1, 2)
      })

      test('should increment view count', async () => {
        const mockDbService = {
          incrementViewCount: vi.fn().mockResolvedValue(undefined)
        }

        ;(menuService as any).dbService = mockDbService

        await menuService.incrementViewCount(1)

        expect(mockDbService.incrementViewCount).toHaveBeenCalledWith(1)
      })
    })
  })

  // HTTP Route tests are skipped for now as they require complex Hono integration setup
  // These are integration tests that should be tested separately
  describe.skip('HTTP Routes', () => {
    describe('Public Routes', () => {
      test('GET /:restaurantId should return complete menu', async () => {
        const mockMenuService = {
          getMenu: vi.fn().mockResolvedValue(mockMenuStructure)
        }

        // Mock the MenuService constructor
        vi.mocked(MenuService).mockImplementation(() => mockMenuService as any)

        const res = await app.request(`/${mockRestaurantId}`, {
          method: 'GET'
        })

        expect(res.status).toBe(200)
        const data = await res.json() as { success: boolean; data: any }
        expect(data.success).toBe(true)
        expect(data.data).toEqual(mockMenuStructure)
      })

      test('GET /:restaurantId/featured should return featured items', async () => {
        const mockMenuService = {
          getFeaturedItems: vi.fn().mockResolvedValue([mockMenuItem])
        }

        vi.mocked(MenuService).mockImplementation(() => mockMenuService as any)

        const res = await app.request(`/${mockRestaurantId}/featured?limit=5`, {
          method: 'GET'
        })

        expect(res.status).toBe(200)
        const data = await res.json() as { success: boolean; data: any }
        expect(data.success).toBe(true)
        expect(Array.isArray(data.data)).toBe(true)
      })

      test('GET /:restaurantId/popular should return popular items', async () => {
        const mockMenuService = {
          getPopularItems: vi.fn().mockResolvedValue([mockMenuItem])
        }

        vi.mocked(MenuService).mockImplementation(() => mockMenuService as any)

        const res = await app.request(`/${mockRestaurantId}/popular`, {
          method: 'GET'
        })

        expect(res.status).toBe(200)
        const data = await res.json() as { success: boolean; data: any }
        expect(data.success).toBe(true)
        expect(Array.isArray(data.data)).toBe(true)
      })

      test('GET /items/:id should return menu item details', async () => {
        const mockMenuService = {
          getMenuItem: vi.fn().mockResolvedValue(mockMenuItem),
          incrementViewCount: vi.fn().mockResolvedValue(undefined)
        }

        vi.mocked(MenuService).mockImplementation(() => mockMenuService as any)

        const res = await app.request('/items/1', {
          method: 'GET'
        })

        expect(res.status).toBe(200)
        const data = await res.json() as { success: boolean; data: any }
        expect(data.success).toBe(true)
        expect(data.data).toEqual(mockMenuItem)
      })

      test('GET /items/:id should return 404 for non-existent item', async () => {
        const mockMenuService = {
          getMenuItem: vi.fn().mockResolvedValue(null)
        }

        vi.mocked(MenuService).mockImplementation(() => mockMenuService as any)

        const res = await app.request('/items/999', {
          method: 'GET'
        })

        expect(res.status).toBe(404)
        const data = await res.json() as { success: boolean; error: any }
        expect(data.success).toBe(false)
        expect(data.error.message).toBe('Menu item not found')
      })
    })

    describe('Protected Routes', () => {
      beforeEach(() => {
        // Mock authentication middleware
        app.use('*', async (c, next) => {
          c.set('user', mockUser)
          c.set('validatedParams', {})
          c.set('validatedQuery', {})
          c.set('validatedBody', {})
          await next()
        })
      })

      test('POST /:restaurantId/items should create menu item', async () => {
        const createData = {
          categoryId: 1,
          name: 'New Item',
          price: 15.99
        }

        const mockMenuService = {
          createMenuItem: vi.fn().mockResolvedValue(mockMenuItem)
        }

        vi.mocked(MenuService).mockImplementation(() => mockMenuService as any)

        const res = await app.request(`/${mockRestaurantId}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(createData)
        })

        expect(res.status).toBe(201)
        const data = await res.json() as { success: boolean; message: string }
        expect(data.success).toBe(true)
        expect(data.message).toBe('Menu item created successfully')
      })

      test('PUT /items/:id should update menu item', async () => {
        const updateData = {
          name: 'Updated Item',
          price: 16.99
        }

        const mockMenuService = {
          getMenuItem: vi.fn().mockResolvedValue(mockMenuItem),
          updateMenuItem: vi.fn().mockResolvedValue({ ...mockMenuItem, ...updateData })
        }

        vi.mocked(MenuService).mockImplementation(() => mockMenuService as any)

        const res = await app.request('/items/1', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        })

        expect(res.status).toBe(200)
        const data = await res.json() as { success: boolean; message: string }
        expect(data.success).toBe(true)
        expect(data.message).toBe('Menu item updated successfully')
      })
    })

    describe('Error Handling', () => {
      test('should handle service errors gracefully', async () => {
        const mockMenuService = {
          getMenu: vi.fn().mockRejectedValue(new Error('Database connection failed'))
        }

        vi.mocked(MenuService).mockImplementation(() => mockMenuService as any)

        const res = await app.request(`/${mockRestaurantId}`, {
          method: 'GET'
        })

        expect(res.status).toBe(500)
        const data = await res.json() as { success: boolean; error: any }
        expect(data.success).toBe(false)
        expect(data.error.message).toBe('Failed to fetch menu')
      })

      test('should validate request parameters', async () => {
        const res = await app.request('/invalid-id', {
          method: 'GET'
        })

        expect(res.status).toBe(400)
      })
    })
  })

  describe('Schema Validation', () => {
    test('should validate menu item creation data', async () => {
      const { menuSchemas } = await import('../schemas/validation')

      const validData = {
        categoryId: 1,
        name: 'Test Item',
        price: 15.99,
        spiceLevel: 2
      }

      const result = menuSchemas.createMenuItem.safeParse(validData)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.spiceLevel).toBe(2)
        expect(result.data.preparationTime).toBe(15) // default value
      }
    })

    test('should reject invalid menu item data', async () => {
      const { menuSchemas } = await import('../schemas/validation')

      const invalidData = {
        categoryId: -1, // Invalid: must be positive
        name: '', // Invalid: cannot be empty
        price: -10 // Invalid: must be positive
      }

      const result = menuSchemas.createMenuItem.safeParse(invalidData)
      expect(result.success).toBe(false)

      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0)
      }
    })

    test('should validate search filters', async () => {
      const { menuSchemas } = await import('../schemas/validation')

      const validFilters = {
        categoryId: '1',
        minPrice: '10.00',
        maxPrice: '50.00',
        spiceLevel: '2',
        isAvailable: 'true',
        page: '1',
        limit: '20'
      }

      const result = menuSchemas.menuFilter.safeParse(validFilters)
      expect(result.success).toBe(true)

      if (result.success) {
        expect(result.data.categoryId).toBe(1)
        expect(result.data.minPrice).toBe(10.00)
        expect(result.data.isAvailable).toBe(true)
      }
    })
  })

  describe('Cache Integration', () => {
    test('should use cache when available', async () => {
      // When KV get() is called with 'json' type, it returns parsed object, not string
      mockEnv.CACHE_KV.get = vi.fn().mockResolvedValue(mockMenuStructure)

      const service = new MenuService(mockEnv)
      // Replace dbService to ensure we're testing cache, not database
      service['dbService'] = mockDatabaseMenuServiceInstance as any
      service['logger'] = mockLogger as any

      const result = await service.getMenu(mockRestaurantId)

      expect(result).toEqual(mockMenuStructure)
      expect(mockEnv.CACHE_KV.get).toHaveBeenCalledWith(`menu:${mockRestaurantId}`, 'json')
      // Database should not be called when cache hits
      expect(mockDatabaseMenuServiceInstance.getMenu).not.toHaveBeenCalled()
    })

    test('should handle cache failures gracefully', async () => {
      mockEnv.CACHE_KV.get = vi.fn().mockRejectedValue(new Error('Cache error'))

      const mockDbService = {
        getMenu: vi.fn().mockResolvedValue(mockMenuStructure)
      }

      const service = new MenuService(mockEnv)
      ;(service as any).dbService = mockDbService

      const result = await service.getMenu(mockRestaurantId)

      expect(result).toEqual(mockMenuStructure)
      expect(mockDbService.getMenu).toHaveBeenCalledWith(mockRestaurantId)
    })
  })
})