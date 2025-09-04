# MakanMakan 測試指南

## 目錄
- [測試架構概覽](#測試架構概覽)
- [單元測試 (Unit Tests)](#單元測試-unit-tests)
- [端到端測試 (E2E Tests)](#端到端測試-e2e-tests)
- [測試環境設置](#測試環境設置)
- [測試命令](#測試命令)
- [CI/CD 整合](#cicd-整合)
- [測試最佳實踐](#測試最佳實踐)

## 測試架構概覽

MakanMakan 使用多層測試策略，確保系統的可靠性和穩定性：

```
測試金字塔
    /\
   /E2E\      ← 端到端測試 (少量，高價值)
  /____\
 /Integration\ ← 整合測試 (中等數量)
/__________\
Unit Tests     ← 單元測試 (大量，快速)
```

### 技術棧
- **單元測試**: Vitest + Vue Test Utils
- **端到端測試**: Playwright
- **API 測試**: Supertest + Miniflare (Cloudflare Workers 本地模擬)
- **測試覆蓋率**: c8 (內建於 Vitest)
- **Mock 工具**: vi.mock (Vitest 內建)

### 測試檔案結構
```
makanmakan/
├── tests/
│   ├── unit/                    # 單元測試
│   │   ├── components/          # Vue 組件測試
│   │   ├── stores/             # Pinia store 測試
│   │   ├── services/           # API 服務測試
│   │   ├── utils/              # 工具函數測試
│   │   └── workers/            # Cloudflare Worker 測試
│   ├── e2e/                    # 端到端測試
│   │   ├── specs/              # 測試規格
│   │   ├── fixtures/           # 測試資料
│   │   └── support/            # 測試輔助函數
│   ├── integration/            # 整合測試
│   │   ├── api/                # API 整合測試
│   │   └── database/           # 資料庫測試
│   └── __mocks__/              # Mock 檔案
├── vitest.config.ts            # Vitest 配置
├── playwright.config.ts        # Playwright 配置
└── coverage/                   # 測試覆蓋率報告
```

## 單元測試 (Unit Tests)

### 1. Vue 組件測試

#### 設置 Vitest 配置

**vitest.config.ts**
```typescript
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.ts',
        '**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

#### 組件測試範例

**tests/unit/components/MenuItemCard.test.ts**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import MenuItemCard from '@/components/MenuItemCard.vue'

describe('MenuItemCard', () => {
  const createWrapper = (props = {}) => {
    const pinia = createPinia()
    return mount(MenuItemCard, {
      props: {
        item: {
          id: 1,
          name: '紅燒牛肉麵',
          price: 180,
          description: '香濃湯頭配軟嫩牛肉',
          image_url: '/images/beef-noodles.jpg',
          available: true,
          category_id: 1
        },
        ...props
      },
      global: {
        plugins: [pinia]
      }
    })
  }

  it('顯示菜品資訊', () => {
    const wrapper = createWrapper()
    
    expect(wrapper.find('[data-testid="item-name"]').text()).toBe('紅燒牛肉麵')
    expect(wrapper.find('[data-testid="item-price"]').text()).toBe('NT$180')
    expect(wrapper.find('[data-testid="item-description"]').text()).toBe('香濃湯頭配軟嫩牛肉')
  })

  it('點擊時觸發加入購物車事件', async () => {
    const wrapper = createWrapper()
    const addButton = wrapper.find('[data-testid="add-to-cart-btn"]')
    
    await addButton.trigger('click')
    
    expect(wrapper.emitted('add-to-cart')).toBeTruthy()
    expect(wrapper.emitted('add-to-cart')[0]).toEqual([{
      id: 1,
      name: '紅燒牛肉麵',
      price: 180
    }])
  })

  it('當商品不可用時顯示禁用狀態', () => {
    const wrapper = createWrapper({
      item: { 
        id: 1, 
        name: '紅燒牛肉麵', 
        price: 180, 
        available: false 
      }
    })
    
    const addButton = wrapper.find('[data-testid="add-to-cart-btn"]')
    expect(addButton.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="unavailable-badge"]').exists()).toBe(true)
  })
})
```

### 2. Store 測試 (Pinia)

**tests/unit/stores/cart.test.ts**
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCartStore } from '@/stores/cart'

describe('Cart Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始狀態為空購物車', () => {
    const cartStore = useCartStore()
    
    expect(cartStore.items).toEqual([])
    expect(cartStore.totalItems).toBe(0)
    expect(cartStore.totalPrice).toBe(0)
  })

  it('正確添加商品到購物車', () => {
    const cartStore = useCartStore()
    const item = {
      id: 1,
      name: '紅燒牛肉麵',
      price: 180,
      quantity: 1
    }
    
    cartStore.addItem(item)
    
    expect(cartStore.items).toHaveLength(1)
    expect(cartStore.items[0]).toEqual(item)
    expect(cartStore.totalItems).toBe(1)
    expect(cartStore.totalPrice).toBe(180)
  })

  it('相同商品增加數量而非新增項目', () => {
    const cartStore = useCartStore()
    const item = {
      id: 1,
      name: '紅燒牛肉麵',
      price: 180,
      quantity: 1
    }
    
    cartStore.addItem(item)
    cartStore.addItem(item)
    
    expect(cartStore.items).toHaveLength(1)
    expect(cartStore.items[0].quantity).toBe(2)
    expect(cartStore.totalPrice).toBe(360)
  })

  it('正確移除購物車商品', () => {
    const cartStore = useCartStore()
    const item = { id: 1, name: '紅燒牛肉麵', price: 180, quantity: 2 }
    
    cartStore.addItem(item)
    cartStore.removeItem(1)
    
    expect(cartStore.items).toHaveLength(0)
    expect(cartStore.totalPrice).toBe(0)
  })

  it('正確更新商品數量', () => {
    const cartStore = useCartStore()
    const item = { id: 1, name: '紅燒牛肉麵', price: 180, quantity: 1 }
    
    cartStore.addItem(item)
    cartStore.updateQuantity(1, 3)
    
    expect(cartStore.items[0].quantity).toBe(3)
    expect(cartStore.totalPrice).toBe(540)
  })

  it('清空購物車', () => {
    const cartStore = useCartStore()
    cartStore.addItem({ id: 1, name: '牛肉麵', price: 180, quantity: 1 })
    cartStore.addItem({ id: 2, name: '排骨飯', price: 150, quantity: 2 })
    
    cartStore.clearCart()
    
    expect(cartStore.items).toEqual([])
    expect(cartStore.totalPrice).toBe(0)
  })
})
```

### 3. API 服務測試

**tests/unit/services/menuApi.test.ts**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { menuApi } from '@/services/menuApi'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Menu API', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  it('成功獲取菜單資料', async () => {
    const mockMenuData = {
      categories: [
        {
          id: 1,
          name: '主食',
          items: [
            { id: 1, name: '紅燒牛肉麵', price: 180, available: true }
          ]
        }
      ]
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockMenuData
    })

    const result = await menuApi.getMenu('restaurant-123')

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/menu/restaurant-123')
    expect(result).toEqual(mockMenuData)
  })

  it('處理 API 錯誤回應', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    await expect(menuApi.getMenu('invalid-id')).rejects.toThrow('HTTP error! status: 404')
  })

  it('處理網路錯誤', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await expect(menuApi.getMenu('restaurant-123')).rejects.toThrow('Network error')
  })
})
```

### 4. 工具函數測試

**tests/unit/utils/format.test.ts**
```typescript
import { describe, it, expect } from 'vitest'
import { formatPrice, formatDate, formatOrderStatus } from '@/utils/format'

describe('Format Utils', () => {
  describe('formatPrice', () => {
    it('正確格式化價格', () => {
      expect(formatPrice(180)).toBe('NT$180')
      expect(formatPrice(1250)).toBe('NT$1,250')
      expect(formatPrice(0)).toBe('NT$0')
    })

    it('處理小數點', () => {
      expect(formatPrice(180.5)).toBe('NT$181') // 四捨五入
      expect(formatPrice(179.4)).toBe('NT$179')
    })
  })

  describe('formatDate', () => {
    it('正確格式化日期', () => {
      const date = new Date('2023-12-25T15:30:00')
      expect(formatDate(date)).toBe('2023/12/25 15:30')
    })

    it('處理字串日期', () => {
      expect(formatDate('2023-12-25T15:30:00Z')).toBe('2023/12/25 15:30')
    })
  })

  describe('formatOrderStatus', () => {
    it('正確格式化訂單狀態', () => {
      expect(formatOrderStatus('pending')).toBe('待處理')
      expect(formatOrderStatus('confirmed')).toBe('已確認')
      expect(formatOrderStatus('preparing')).toBe('製作中')
      expect(formatOrderStatus('ready')).toBe('待取餐')
      expect(formatOrderStatus('completed')).toBe('已完成')
    })

    it('處理未知狀態', () => {
      expect(formatOrderStatus('unknown')).toBe('未知狀態')
    })
  })
})
```

### 5. Cloudflare Worker 測試

**tests/unit/workers/api.test.ts**
```typescript
import { describe, it, expect, vi } from 'vitest'
import { unstable_dev } from 'wrangler'
import type { UnstableDevWorker } from 'wrangler'

describe('API Worker', () => {
  let worker: UnstableDevWorker

  beforeAll(async () => {
    worker = await unstable_dev('apps/api/src/index.ts', {
      experimental: { disableExperimentalWarning: true }
    })
  })

  afterAll(async () => {
    await worker.stop()
  })

  it('健康檢查端點', async () => {
    const resp = await worker.fetch('/health')
    
    expect(resp.status).toBe(200)
    
    const data = await resp.json()
    expect(data).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(Number)
    })
  })

  it('獲取餐廳菜單', async () => {
    const resp = await worker.fetch('/api/v1/menu/test-restaurant')
    
    expect(resp.status).toBe(200)
    
    const menu = await resp.json()
    expect(menu).toHaveProperty('categories')
    expect(Array.isArray(menu.categories)).toBe(true)
  })

  it('處理不存在的餐廳', async () => {
    const resp = await worker.fetch('/api/v1/menu/non-existent')
    
    expect(resp.status).toBe(404)
    
    const error = await resp.json()
    expect(error).toMatchObject({
      error: 'Restaurant not found'
    })
  })

  it('CORS 標頭設置正確', async () => {
    const resp = await worker.fetch('/api/v1/menu/test-restaurant')
    
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(resp.headers.get('Access-Control-Allow-Methods')).toContain('GET')
  })
})
```

## 端到端測試 (E2E Tests)

### Playwright 設置

**playwright.config.ts**
```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    }
  ],

  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI
  }
})
```

### E2E 測試範例

**tests/e2e/specs/ordering-flow.spec.ts**
```typescript
import { test, expect } from '@playwright/test'

test.describe('顧客點餐流程', () => {
  test.beforeEach(async ({ page }) => {
    // 掃描 QR Code 進入餐廳
    await page.goto('/menu/restaurant-123/table-5')
  })

  test('完整點餐流程', async ({ page }) => {
    // 1. 查看菜單
    await expect(page.locator('h1')).toContainText('美味餐廳菜單')
    
    // 2. 添加商品到購物車
    await page.locator('[data-testid="menu-item-1"] [data-testid="add-btn"]').click()
    await page.locator('[data-testid="menu-item-3"] [data-testid="add-btn"]').click()
    
    // 3. 檢查購物車數量
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('2')
    
    // 4. 進入購物車頁面
    await page.locator('[data-testid="cart-btn"]').click()
    await expect(page.locator('h2')).toContainText('您的訂單')
    
    // 5. 修改商品數量
    await page.locator('[data-testid="quantity-increase-1"]').click()
    await expect(page.locator('[data-testid="item-quantity-1"]')).toHaveText('2')
    
    // 6. 填寫顧客資訊
    await page.locator('[data-testid="customer-name"]').fill('王小明')
    await page.locator('[data-testid="customer-phone"]').fill('0912345678')
    
    // 7. 提交訂單
    await page.locator('[data-testid="submit-order-btn"]').click()
    
    // 8. 確認訂單提交成功
    await expect(page.locator('[data-testid="order-success-message"]')).toBeVisible()
    await expect(page.locator('[data-testid="order-number"]')).toContainText('#')
  })

  test('訂單追蹤功能', async ({ page }) => {
    // 提交訂單後進入追蹤頁面
    await page.goto('/order-tracking/order-123')
    
    // 檢查訂單狀態顯示
    await expect(page.locator('[data-testid="order-status"]')).toContainText('製作中')
    
    // 檢查時間線顯示
    await expect(page.locator('[data-testid="timeline-step-confirmed"]')).toHaveClass(/completed/)
    await expect(page.locator('[data-testid="timeline-step-preparing"]')).toHaveClass(/active/)
  })

  test('商品客製化選項', async ({ page }) => {
    // 點擊有客製化選項的商品
    await page.locator('[data-testid="menu-item-2"]').click()
    
    // 檢查客製化彈窗出現
    await expect(page.locator('[data-testid="customization-modal"]')).toBeVisible()
    
    // 選擇辣度
    await page.locator('[data-testid="spice-level-medium"]').click()
    
    // 選擇額外配料
    await page.locator('[data-testid="extra-cheese"]').check()
    
    // 添加備註
    await page.locator('[data-testid="special-notes"]').fill('少油少鹽')
    
    // 確認添加
    await page.locator('[data-testid="add-customized-item"]').click()
    
    // 檢查客製化資訊在購物車中正確顯示
    await page.locator('[data-testid="cart-btn"]').click()
    await expect(page.locator('[data-testid="item-customization-1"]')).toContainText('中辣')
    await expect(page.locator('[data-testid="item-customization-1"]')).toContainText('加起司')
  })
})
```

**tests/e2e/specs/admin-dashboard.spec.ts**
```typescript
import { test, expect } from '@playwright/test'

test.describe('管理後台', () => {
  test.beforeEach(async ({ page }) => {
    // 登入管理員帳號
    await page.goto('/admin/login')
    await page.locator('[data-testid="username"]').fill('admin@restaurant.com')
    await page.locator('[data-testid="password"]').fill('password123')
    await page.locator('[data-testid="login-btn"]').click()
    
    await expect(page.locator('h1')).toContainText('管理後台')
  })

  test('菜單管理功能', async ({ page }) => {
    await page.locator('[data-testid="menu-management"]').click()
    
    // 新增菜品
    await page.locator('[data-testid="add-item-btn"]').click()
    await page.locator('[data-testid="item-name"]').fill('新品牛排')
    await page.locator('[data-testid="item-price"]').fill('350')
    await page.locator('[data-testid="item-description"]').fill('嫩煎牛排配時蔬')
    
    // 上傳圖片
    await page.locator('[data-testid="image-upload"]').setInputFiles('tests/fixtures/steak.jpg')
    
    await page.locator('[data-testid="save-item-btn"]').click()
    
    // 確認新菜品出現在列表中
    await expect(page.locator('[data-testid="menu-item"]').last()).toContainText('新品牛排')
  })

  test('訂單管理功能', async ({ page }) => {
    await page.locator('[data-testid="order-management"]').click()
    
    // 查看待處理訂單
    await expect(page.locator('[data-testid="pending-orders"]').first()).toBeVisible()
    
    // 更新訂單狀態
    await page.locator('[data-testid="order-123"] [data-testid="status-dropdown"]').selectOption('preparing')
    
    // 確認狀態更新
    await expect(page.locator('[data-testid="order-123"] [data-testid="order-status"]')).toContainText('製作中')
  })

  test('桌號 QR Code 管理', async ({ page }) => {
    await page.locator('[data-testid="table-management"]').click()
    
    // 新增桌號
    await page.locator('[data-testid="add-table-btn"]').click()
    await page.locator('[data-testid="table-number"]').fill('15')
    await page.locator('[data-testid="table-seats"]').fill('4')
    await page.locator('[data-testid="save-table-btn"]').click()
    
    // 產生 QR Code
    await page.locator('[data-testid="table-15"] [data-testid="generate-qr-btn"]').click()
    
    // 確認 QR Code 產生成功
    await expect(page.locator('[data-testid="qr-code-modal"]')).toBeVisible()
    await expect(page.locator('[data-testid="qr-code-image"]')).toBeVisible()
  })
})
```

### 測試輔助工具

**tests/e2e/support/helpers.ts**
```typescript
import { Page, expect } from '@playwright/test'

export class OrderingHelper {
  constructor(private page: Page) {}

  async addItemToCart(itemId: string, quantity: number = 1) {
    for (let i = 0; i < quantity; i++) {
      await this.page.locator(`[data-testid="menu-item-${itemId}"] [data-testid="add-btn"]`).click()
    }
  }

  async goToCart() {
    await this.page.locator('[data-testid="cart-btn"]').click()
  }

  async fillCustomerInfo(name: string, phone: string) {
    await this.page.locator('[data-testid="customer-name"]').fill(name)
    await this.page.locator('[data-testid="customer-phone"]').fill(phone)
  }

  async submitOrder() {
    await this.page.locator('[data-testid="submit-order-btn"]').click()
    return await this.page.locator('[data-testid="order-number"]').textContent()
  }

  async expectCartCount(count: number) {
    await expect(this.page.locator('[data-testid="cart-count"]')).toHaveText(count.toString())
  }
}

export class AdminHelper {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.goto('/admin/login')
    await this.page.locator('[data-testid="username"]').fill(email)
    await this.page.locator('[data-testid="password"]').fill(password)
    await this.page.locator('[data-testid="login-btn"]').click()
  }

  async addMenuItem(item: {
    name: string
    price: string
    description: string
    imagePath?: string
  }) {
    await this.page.locator('[data-testid="add-item-btn"]').click()
    await this.page.locator('[data-testid="item-name"]').fill(item.name)
    await this.page.locator('[data-testid="item-price"]').fill(item.price)
    await this.page.locator('[data-testid="item-description"]').fill(item.description)
    
    if (item.imagePath) {
      await this.page.locator('[data-testid="image-upload"]').setInputFiles(item.imagePath)
    }
    
    await this.page.locator('[data-testid="save-item-btn"]').click()
  }
}
```

### 測試資料管理

**tests/fixtures/menu-data.json**
```json
{
  "testRestaurant": {
    "id": "test-restaurant-123",
    "name": "測試餐廳",
    "categories": [
      {
        "id": 1,
        "name": "主食",
        "items": [
          {
            "id": 1,
            "name": "紅燒牛肉麵",
            "price": 180,
            "description": "香濃湯頭配軟嫩牛肉",
            "image_url": "/images/beef-noodles.jpg",
            "available": true
          },
          {
            "id": 2,
            "name": "招牌排骨飯",
            "price": 150,
            "description": "酥脆排骨配滷蛋青菜",
            "image_url": "/images/pork-rice.jpg",
            "available": true
          }
        ]
      },
      {
        "id": 2,
        "name": "飲料",
        "items": [
          {
            "id": 3,
            "name": "珍珠奶茶",
            "price": 60,
            "description": "經典珍珠奶茶",
            "image_url": "/images/bubble-tea.jpg",
            "available": true
          }
        ]
      }
    ]
  }
}
```

## 測試環境設置

### 本地開發環境

**package.json 測試腳本**
```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest --watch",
    "test:ci": "pnpm run test:unit && pnpm run test:e2e"
  }
}
```

### 測試設置檔案

**tests/setup.ts**
```typescript
import { vi } from 'vitest'
import { config } from '@vue/test-utils'

// 全域 mock
vi.mock('@/services/api', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
}))

// Vue Test Utils 全域配置
config.global.mocks = {
  $t: (key: string) => key, // i18n mock
  $route: { params: {}, query: {} },
  $router: { push: vi.fn() }
}

// 環境變數設置
process.env.NODE_ENV = 'test'
process.env.VITE_API_BASE_URL = 'http://localhost:3000'
```

### Docker 測試環境

**docker-compose.test.yml**
```yaml
version: '3.8'
services:
  test-db:
    image: sqlite:3.40
    volumes:
      - ./tests/fixtures:/fixtures
    environment:
      SQLITE_DATABASE: test.db
    
  test-api:
    build:
      context: .
      dockerfile: Dockerfile.test
    depends_on:
      - test-db
    environment:
      NODE_ENV: test
      DATABASE_URL: sqlite://test-db/test.db
    ports:
      - "3001:3000"

  playwright:
    image: mcr.microsoft.com/playwright:latest
    depends_on:
      - test-api
    volumes:
      - .:/workspace
    working_dir: /workspace
    command: npx playwright test
```

## CI/CD 整合

### GitHub Actions 配置

**.github/workflows/test.yml**
```yaml
name: 測試流水線

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: 設置 Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
          
      - name: 📦 安裝 pnpm
        uses: pnpm/action-setup@v4
        with:
          version: '10'
          
      - name: 安裝依賴
        run: pnpm install --frozen-lockfile
        
      - name: 執行單元測試
        run: pnpm run test:unit
        
      - name: 產生覆蓋率報告
        run: pnpm run test:coverage
        
      - name: 上傳覆蓋率到 Codecov
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: 設置 Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
          
      - name: 📦 安裝 pnpm
        uses: pnpm/action-setup@v4
        with:
          version: '10'
          
      - name: 安裝依賴
        run: pnpm install --frozen-lockfile
        
      - name: 安裝 Playwright
        run: npx playwright install --with-deps
        
      - name: 啟動測試服務
        run: pnpm run dev &
        
      - name: 等待服務啟動
        run: npx wait-on http://localhost:5173
        
      - name: 執行 E2E 測試
        run: pnpm run test:e2e
        
      - name: 上傳測試報告
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  worker-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: 設置 Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'pnpm'
          
      - name: 📦 安裝 pnpm
        uses: pnpm/action-setup@v4
        with:
          version: '10'
          
      - name: 安裝依賴
        run: pnpm install --frozen-lockfile
        
      - name: 測試 Cloudflare Workers
        run: pnpm run test:workers
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 測試報告集成

**測試覆蓋率目標**
- 單元測試覆蓋率：≥ 80%
- 整合測試覆蓋率：≥ 70%
- 關鍵路徑測試覆蓋率：100%

**品質門檻**
```javascript
// vitest.config.ts 中的覆蓋率設置
export default defineConfig({
  test: {
    coverage: {
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    }
  }
})
```

## 測試最佳實踐

### 1. 測試命名規範
- **檔案命名**: `ComponentName.test.ts`
- **測試描述**: 使用中文，清楚描述測試目的
- **分組**: 使用 `describe` 按功能分組

### 2. 測試資料管理
- 使用 Factory Pattern 建立測試資料
- 測試間互相隔離，不共享狀態
- 使用 fixtures 管理複雜測試資料

### 3. Mock 策略
```typescript
// 優先 mock 外部依賴
vi.mock('@/services/api')

// 使用 partial mock 保留部分真實邏輯
vi.mocked(apiService.get).mockImplementation(async (url) => {
  if (url.includes('/menu')) {
    return mockMenuData
  }
  // 其他 API 使用真實實作
  return originalApiService.get(url)
})
```

### 4. 異步測試處理
```typescript
// 正確等待異步操作
test('API 呼叫', async () => {
  const promise = apiService.getMenu('123')
  await expect(promise).resolves.toEqual(expectedData)
})

// Vue 組件異步更新
test('組件更新', async () => {
  await wrapper.vm.$nextTick()
  expect(wrapper.find('.updated-content')).toBe(true)
})
```

### 5. 錯誤處理測試
```typescript
test('處理 API 錯誤', async () => {
  mockApiService.get.mockRejectedValue(new Error('Network error'))
  
  const result = await menuService.getMenu('123')
  
  expect(result.error).toBe('Failed to load menu')
  expect(mockErrorLogger.log).toHaveBeenCalled()
})
```

### 6. 效能測試
```typescript
test('大量資料處理效能', () => {
  const startTime = performance.now()
  
  processLargeDataset(thousandItems)
  
  const endTime = performance.now()
  expect(endTime - startTime).toBeLessThan(100) // 100ms 內完成
})
```

### 7. 可訪問性測試
```typescript
// Playwright 中測試可訪問性
test('頁面可訪問性', async ({ page }) => {
  await page.goto('/menu')
  
  const accessibilityTest = await page.accessibility.snapshot()
  expect(accessibilityTest).toMatchSnapshot('menu-accessibility.json')
})
```

---

## 總結

這份測試指南涵蓋了 MakanMakan 專案的完整測試策略，包括：

1. **完整的測試金字塔** - 從單元測試到端到端測試
2. **實用的範例程式碼** - 可直接應用到專案中
3. **自動化 CI/CD 整合** - 確保程式碼品質
4. **最佳實踐指導** - 提高測試效率和可維護性

定期執行測試並監控覆蓋率，確保系統的穩定性和可靠性。