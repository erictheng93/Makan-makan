/**
 * Restaurant Factory for Test Data Generation
 */

import {
  BaseFactory,
  type FactoryOptions,
  randomString,
  randomEmail,
  randomPhone,
  randomChoice,
  randomBoolean,
  currentTimestamp
} from './base.factory'

/**
 * 餐廳測試數據
 */
export interface RestaurantTestData {
  id?: number
  name: string
  type: string
  category: string
  description: string
  address: string
  district: string
  city: string
  phone: string
  email: string
  website: string | null
  businessHours: Record<string, any>
  isAvailable: boolean
  isActive: boolean
  status: number
  logoUrl: string | null
  bannerUrl: string | null
  imageUrls: string[]
  shopQrCode: string | null
  shopQrCodeImageUrl: string | null
  enableShopMode: boolean
  shopQrSettings: Record<string, any>
  shopQrVersion: number
  settings: Record<string, any>
  rating: number
  reviewCount: number
  totalOrders: number
  createdAt: number
  updatedAt: number
}

/**
 * 餐廳類型
 */
export const RestaurantTypes = {
  DINE_IN: 'dine_in',
  TAKEAWAY: 'takeaway',
  DELIVERY: 'delivery',
  ALL: 'all'
} as const

/**
 * 餐廳分類
 */
export const RestaurantCategories = [
  '中式料理',
  '日式料理',
  '韓式料理',
  '西式料理',
  '泰式料理',
  '越南料理',
  '印度料理',
  '快餐',
  '咖啡廳',
  '酒吧',
  '甜點店',
  '素食'
] as const

/**
 * 台中市區域
 */
export const TaichungDistricts = [
  '中區', '東區', '南區', '西區', '北區',
  '北屯區', '西屯區', '南屯區', '太平區',
  '大里區', '霧峰區', '烏日區', '豐原區'
] as const

/**
 * 餐廳工廠
 */
export class RestaurantFactory extends BaseFactory<RestaurantTestData> {
  /**
   * 生成餐廳測試數據
   */
  build(options?: FactoryOptions<RestaurantTestData>): RestaurantTestData {
    const sequence = options?.sequence ?? this.getNextSequence()
    const category = randomChoice([...RestaurantCategories])

    const baseData: RestaurantTestData = {
      id: sequence + 1,
      name: `${category}餐廳 #${sequence + 1}`,
      type: randomChoice([
        RestaurantTypes.DINE_IN,
        RestaurantTypes.TAKEAWAY,
        RestaurantTypes.ALL
      ]),
      category,
      description: `這是一家美味的${category}餐廳,提供優質的餐飲服務。`,
      address: `台中市${randomChoice([...TaichungDistricts])}測試路 ${sequence + 1} 號`,
      district: randomChoice([...TaichungDistricts]),
      city: '台中市',
      phone: randomPhone(),
      email: randomEmail('restaurant-test.com'),
      website: randomBoolean(0.7) ? `https://restaurant-${sequence + 1}.com` : null,
      businessHours: {
        monday: { open: '11:00', close: '21:00', closed: false },
        tuesday: { open: '11:00', close: '21:00', closed: false },
        wednesday: { open: '11:00', close: '21:00', closed: false },
        thursday: { open: '11:00', close: '21:00', closed: false },
        friday: { open: '11:00', close: '22:00', closed: false },
        saturday: { open: '11:00', close: '22:00', closed: false },
        sunday: { open: '11:00', close: '21:00', closed: false }
      },
      isAvailable: true,
      isActive: true,
      status: 1,
      logoUrl: randomBoolean(0.8) ? `https://cdn.example.com/logos/restaurant-${sequence + 1}.png` : null,
      bannerUrl: randomBoolean(0.7) ? `https://cdn.example.com/banners/restaurant-${sequence + 1}.jpg` : null,
      imageUrls: Array.from({ length: 3 }, (_, i) =>
        `https://cdn.example.com/restaurants/${sequence + 1}/image-${i + 1}.jpg`
      ),
      shopQrCode: null,
      shopQrCodeImageUrl: null,
      enableShopMode: false,
      shopQrSettings: {},
      shopQrVersion: 1,
      settings: {
        acceptReservations: randomBoolean(0.8),
        acceptWalkIns: true,
        maxPartySize: 10,
        currency: 'TWD',
        taxRate: 0.05,
        serviceChargeRate: 0.1
      },
      rating: 4.0 + Math.random(),
      reviewCount: Math.floor(Math.random() * 100),
      totalOrders: Math.floor(Math.random() * 1000),
      createdAt: currentTimestamp(),
      updatedAt: currentTimestamp()
    }

    return {
      ...baseData,
      ...options?.overrides
    }
  }

  /**
   * 生成啟用 Shop QR 模式的餐廳
   */
  buildWithShopMode(options?: FactoryOptions<RestaurantTestData>): RestaurantTestData {
    const sequence = this.getNextSequence()
    return this.build({
      ...options,
      overrides: {
        enableShopMode: true,
        shopQrCode: `SHOP_${randomString(12).toUpperCase()}`,
        shopQrCodeImageUrl: `https://cdn.example.com/qr/shop-${sequence + 1}.png`,
        shopQrSettings: {
          maxOrdersPerScan: 1,
          requireCustomerInfo: true,
          autoAssignTable: false
        },
        ...options?.overrides
      }
    })
  }

  /**
   * 生成快餐店
   */
  buildFastFood(options?: FactoryOptions<RestaurantTestData>): RestaurantTestData {
    return this.build({
      ...options,
      overrides: {
        category: '快餐',
        type: RestaurantTypes.ALL,
        settings: {
          acceptReservations: false,
          acceptWalkIns: true,
          maxPartySize: 4,
          currency: 'TWD',
          taxRate: 0.05,
          serviceChargeRate: 0
        },
        ...options?.overrides
      }
    })
  }

  /**
   * 生成高級餐廳
   */
  buildFineDining(options?: FactoryOptions<RestaurantTestData>): RestaurantTestData {
    return this.build({
      ...options,
      overrides: {
        type: RestaurantTypes.DINE_IN,
        settings: {
          acceptReservations: true,
          acceptWalkIns: false,
          maxPartySize: 12,
          currency: 'TWD',
          taxRate: 0.05,
          serviceChargeRate: 0.15
        },
        rating: 4.5 + Math.random() * 0.5,
        ...options?.overrides
      }
    })
  }

  /**
   * 生成咖啡廳
   */
  buildCafe(options?: FactoryOptions<RestaurantTestData>): RestaurantTestData {
    return this.build({
      ...options,
      overrides: {
        category: '咖啡廳',
        type: RestaurantTypes.DINE_IN,
        businessHours: {
          monday: { open: '08:00', close: '18:00', closed: false },
          tuesday: { open: '08:00', close: '18:00', closed: false },
          wednesday: { open: '08:00', close: '18:00', closed: false },
          thursday: { open: '08:00', close: '18:00', closed: false },
          friday: { open: '08:00', close: '20:00', closed: false },
          saturday: { open: '09:00', close: '20:00', closed: false },
          sunday: { open: '09:00', close: '18:00', closed: false }
        },
        settings: {
          acceptReservations: false,
          acceptWalkIns: true,
          maxPartySize: 6,
          currency: 'TWD',
          taxRate: 0.05,
          serviceChargeRate: 0
        },
        ...options?.overrides
      }
    })
  }
}

// 導出單例實例
export const restaurantFactory = new RestaurantFactory()
