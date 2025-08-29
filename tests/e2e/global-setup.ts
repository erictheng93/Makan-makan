import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use
  
  console.log(`🚀 正在設置 E2E 測試環境...`)
  console.log(`📍 Base URL: ${baseURL}`)
  
  // 等待服務啟動
  const browser = await chromium.launch()
  const page = await browser.newPage()
  
  try {
    // 嘗試訪問健康檢查端點
    await page.goto(`${baseURL}/health`, { timeout: 60000 })
    console.log('✅ 服務已啟動並準備就緒')
  } catch (error) {
    console.error('❌ 服務啟動失敗:', error)
    throw error
  } finally {
    await browser.close()
  }
  
  // 設置測試資料庫
  console.log('📊 正在初始化測試資料...')
  await setupTestData()
  
  console.log('✅ E2E 測試環境設置完成')
}

async function setupTestData() {
  // 這裡可以設置測試所需的初始資料
  // 例如：創建測試餐廳、測試菜單等
  
  const testData = {
    restaurants: [
      {
        id: 'test-restaurant-123',
        name: '測試餐廳',
        description: 'E2E 測試專用餐廳'
      }
    ],
    menuItems: [
      {
        id: 1,
        restaurant_id: 'test-restaurant-123',
        name: '紅燒牛肉麵',
        price: 180,
        description: '香濃湯頭配軟嫩牛肉',
        available: true
      },
      {
        id: 2,
        restaurant_id: 'test-restaurant-123',
        name: '招牌排骨飯',
        price: 150,
        description: '酥脆排骨配滷蛋青菜',
        available: true
      }
    ],
    tables: [
      {
        id: 1,
        restaurant_id: 'test-restaurant-123',
        number: '1',
        seats: 4
      },
      {
        id: 2,
        restaurant_id: 'test-restaurant-123',
        number: '2',
        seats: 2
      }
    ]
  }
  
  // 實際專案中這裡會呼叫 API 或直接操作資料庫來設置測試資料
  console.log('測試資料已準備就緒:', Object.keys(testData))
}

export default globalSetup