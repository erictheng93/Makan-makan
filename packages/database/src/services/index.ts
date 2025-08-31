// 匯出所有服務類別
export { BaseService } from './base'
export { USER_ROLES } from '../schema'
export { RestaurantService } from './restaurant'
export { MenuService } from './menu' 
export { OrderService } from './order'
export { AuthService } from './auth'
export { UserService } from './user'
export { SessionService } from './session'
export { TableService } from './table'
export { AnalyticsService } from './analytics'
export { ErrorReportingService } from './error-reporting'
export { QRCodeService } from './qrcode'
export { ImageService } from './image'

// 匯出類型定義
export type { 
  CreateRestaurantData, 
  UpdateRestaurantData 
} from './restaurant'

export type {
  CreateMenuItemData,
  UpdateMenuItemData,
  MenuFilters
} from './menu'

export type {
  CreateOrderData,
  UpdateOrderStatusData,
  OrderFilters
} from './order'

export type {
  CreateErrorReportData,
  ErrorReportFilters,
  ErrorStats
} from './error-reporting'

export type {
  CreateQRCodeData,
  CreateQRTemplateData,
  QRStyleData,
  QRCodeStats
} from './qrcode'

export type {
  ImageAnalyticsOptions,
  StorageAnalytics,
  UsageAnalytics,
  PerformanceAnalytics,
  CreateImageData
} from './image'