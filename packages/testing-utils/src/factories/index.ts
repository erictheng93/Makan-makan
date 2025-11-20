/**
 * Test Data Factories Index
 *
 * 統一導出所有測試數據工廠
 */

// Base factory and utilities
export * from './base.factory'

// User factory
export * from './user.factory'

// Restaurant factory
export * from './restaurant.factory'

// Menu factories
export * from './menu.factory'

// Order factories
export * from './order.factory'

// Import factories directly to avoid circular dependency
import { userFactory } from './user.factory'
import { restaurantFactory } from './restaurant.factory'
import { categoryFactory, menuItemFactory } from './menu.factory'
import { orderFactory, orderItemFactory } from './order.factory'

/**
 * 重置所有工廠的序列計數器
 */
export function resetAllFactories(): void {
  userFactory.resetSequence()
  restaurantFactory.resetSequence()
  categoryFactory.resetSequence()
  menuItemFactory.resetSequence()
  orderFactory.resetSequence()
  orderItemFactory.resetSequence()
}

/**
 * 快速生成完整的測試餐廳數據
 *
 * 包含餐廳、員工、分類、菜單、訂單等完整數據
 */
export function buildCompleteRestaurantData(options?: {
  enableShopMode?: boolean
  categoryCount?: number
  menuItemsPerCategory?: number
  orderCount?: number
}) {
  // 重置序列號確保 ID 從 1 開始
  resetAllFactories()

  // 1. 創建餐廳
  const restaurant = options?.enableShopMode
    ? restaurantFactory.buildWithShopMode()
    : restaurantFactory.build()

  // 2. 創建員工團隊
  const team = userFactory.buildRestaurantTeam(restaurant.id!)

  // 3. 創建分類
  const categories = categoryFactory.buildRestaurantCategories(restaurant.id!)

  // 4. 創建菜單項目
  const menuItems = categories.flatMap((category) =>
    menuItemFactory.buildForCategory(
      restaurant.id!,
      category.id!,
      category.name,
      options?.menuItemsPerCategory ?? 5
    )
  )

  // 5. 創建訂單
  const orders = orderFactory.buildList(options?.orderCount ?? 10, {
    relations: { restaurantId: restaurant.id! }
  })

  // 6. 為每個訂單創建項目
  const orderItems = orders.flatMap((order) =>
    orderItemFactory.buildForOrder(order.id!, 3)
  )

  // 7. 創建顧客
  const customers = userFactory.buildList(20, {
    overrides: { role: 5, restaurantId: null } // Customer role
  })

  return {
    restaurant,
    team: {
      owner: team.owner,
      chefs: team.chefs,
      serviceCrews: team.serviceCrews,
      cashiers: team.cashiers,
      all: [team.owner, ...team.chefs, ...team.serviceCrews, ...team.cashiers]
    },
    categories,
    menuItems,
    orders,
    orderItems,
    customers,
    summary: {
      restaurantCount: 1,
      employeeCount: team.chefs.length + team.serviceCrews.length + team.cashiers.length + 1,
      categoryCount: categories.length,
      menuItemCount: menuItems.length,
      orderCount: orders.length,
      orderItemCount: orderItems.length,
      customerCount: customers.length
    }
  }
}
