/**
 * POS功能模組入口
 * 統一匯出所有POS相關功能
 */

import routes from "./routes";

export * from "./services";
export * from "./types";
export * from "./schemas";

export { routes };

// 預設匯出（為了相容性）
export default {
  routes,
};
