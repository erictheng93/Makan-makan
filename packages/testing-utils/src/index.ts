/**
 * MakanMakan Testing Utils
 *
 * 統一的測試工具和數據工廠
 */

// Export all factories
export * from "./factories";

// Export mock DB infrastructure
export * from "./mocks/mock-drizzle-db";

// Re-export commonly used items for convenience
export {
  userFactory,
  UserRoles,
  restaurantFactory,
  RestaurantTypes,
  categoryFactory,
  menuItemFactory,
  orderFactory,
  orderItemFactory,
  resetAllFactories,
  buildCompleteRestaurantData,
  // Env / infrastructure mocks
  createMockD1Database,
  createMockKV,
  envFactory,
  createMockContext,
  // Print factories
  printJobFactory,
  printerDeviceFactory,
  printRequestFactory,
  printServiceConfigFactory,
  // Realtime factories
  realtimeAuthFactory,
  realtimeEventFactory,
  createMockWebSocketPair,
  getStringRole,
} from "./factories";
