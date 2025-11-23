/**
 * User Factory for Test Data Generation
 */

import {
  BaseFactory,
  type FactoryOptions,
  randomString,
  randomEmail,
  randomPhone,
  currentTimestamp,
  randomChoice
} from './base.factory'

/**
 * 用戶測試數據
 */
export interface UserTestData {
  id?: number
  username: string
  email: string
  phone: string
  fullName: string
  passwordHash: string
  role: number
  restaurantId: number | null
  isActive: boolean
  isVerified: boolean
  preferences: Record<string, any>
  totalOrders: number
  totalSpent: number
  lastLoginAt: number | null
  createdAt: number
  updatedAt: number
}

/**
 * 用戶角色常量
 */
export const UserRoles = {
  ADMIN: 0,
  SHOP_OWNER: 1,
  CHEF: 2,
  SERVICE_CREW: 3,
  CASHIER: 4,
  CUSTOMER: 5
} as const

/**
 * 用戶工廠
 */
export class UserFactory extends BaseFactory<UserTestData> {
  /**
   * 生成用戶測試數據
   */
  build(options?: FactoryOptions<UserTestData>): UserTestData {
    const sequence = options?.sequence ?? this.getNextSequence()
    const role = options?.overrides?.role ?? UserRoles.CUSTOMER

    const baseData: UserTestData = {
      id: sequence + 1,
      username: `user_${randomString(8, `test_${sequence}_`)}`,
      email: randomEmail('makanmakan-test.com'),
      phone: randomPhone(),
      fullName: `測試用戶 ${sequence + 1}`,
      passwordHash: '$2a$10$test.hash.for.testing.only', // bcrypt hash for 'password'
      role,
      restaurantId: role !== UserRoles.CUSTOMER ? 1 : null,
      isActive: true,
      isVerified: true,
      preferences: {
        language: 'zh-TW',
        notifications: true,
        theme: 'light'
      },
      totalOrders: 0,
      totalSpent: 0,
      lastLoginAt: null,
      createdAt: currentTimestamp(),
      updatedAt: currentTimestamp()
    }

    return {
      ...baseData,
      ...options?.overrides
    }
  }

  /**
   * 快速生成管理員
   */
  buildAdmin(options?: FactoryOptions<UserTestData>): UserTestData {
    return this.build({
      ...options,
      overrides: {
        role: UserRoles.ADMIN,
        fullName: '系統管理員',
        ...options?.overrides
      }
    })
  }

  /**
   * 快速生成店主
   */
  buildShopOwner(restaurantId: number, options?: FactoryOptions<UserTestData>): UserTestData {
    return this.build({
      ...options,
      overrides: {
        role: UserRoles.SHOP_OWNER,
        restaurantId,
        fullName: `店主 ${restaurantId}`,
        ...options?.overrides
      }
    })
  }

  /**
   * 快速生成廚師
   */
  buildChef(restaurantId: number, options?: FactoryOptions<UserTestData>): UserTestData {
    return this.build({
      ...options,
      overrides: {
        role: UserRoles.CHEF,
        restaurantId,
        fullName: `廚師 ${this.getNextSequence()}`,
        ...options?.overrides
      }
    })
  }

  /**
   * 快速生成服務員
   */
  buildServiceCrew(restaurantId: number, options?: FactoryOptions<UserTestData>): UserTestData {
    return this.build({
      ...options,
      overrides: {
        role: UserRoles.SERVICE_CREW,
        restaurantId,
        fullName: `服務員 ${this.getNextSequence()}`,
        ...options?.overrides
      }
    })
  }

  /**
   * 快速生成收銀員
   */
  buildCashier(restaurantId: number, options?: FactoryOptions<UserTestData>): UserTestData {
    return this.build({
      ...options,
      overrides: {
        role: UserRoles.CASHIER,
        restaurantId,
        fullName: `收銀員 ${this.getNextSequence()}`,
        ...options?.overrides
      }
    })
  }

  /**
   * 快速生成顧客
   */
  buildCustomer(options?: FactoryOptions<UserTestData>): UserTestData {
    return this.build({
      ...options,
      overrides: {
        role: UserRoles.CUSTOMER,
        restaurantId: null,
        ...options?.overrides
      }
    })
  }

  /**
   * 生成完整的餐廳員工團隊
   */
  buildRestaurantTeam(restaurantId: number): {
    owner: UserTestData
    chefs: UserTestData[]
    serviceCrews: UserTestData[]
    cashiers: UserTestData[]
  } {
    return {
      owner: this.buildShopOwner(restaurantId),
      chefs: this.buildList(2, {
        overrides: { role: UserRoles.CHEF, restaurantId }
      }),
      serviceCrews: this.buildList(3, {
        overrides: { role: UserRoles.SERVICE_CREW, restaurantId }
      }),
      cashiers: this.buildList(2, {
        overrides: { role: UserRoles.CASHIER, restaurantId }
      })
    }
  }
}

// 導出單例實例
export const userFactory = new UserFactory()
