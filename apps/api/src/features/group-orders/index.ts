/**
 * Group Orders Feature Module
 * Entry point for the group orders feature
 */

import routes from './routes'
import { GroupOrdersService } from './services/GroupOrdersService'
import { groupOrderSchemas } from './schemas/validation'

// Export the feature module
export const groupOrdersFeature = {
  routes,
  service: GroupOrdersService,
  schemas: groupOrderSchemas
}

// Export types for external use
export type {
  GroupOrder,
  GroupOrderMember,
  GroupOrderCartItem,
  GroupOrderActivity,
  GroupOrderSummary,
  GroupOrderStatistics,
  CreateGroupOrderRequest,
  CreateGroupOrderResponse,
  JoinGroupRequest,
  JoinGroupResponse,
  AddCartItemRequest,
  UpdateCartItemRequest,
  SplitBillRequest,
  ProcessPaymentRequest,
  GroupOrderStatus,
  PaymentStatus,
  ActivityType,
  IGroupOrderService,
  GroupOrderEvent
} from './types'

// Export schemas for external use
export { groupOrderSchemas } from './schemas/validation'

// Export service for external use
export { GroupOrdersService } from './services/GroupOrdersService'

// Default export for easy import
export default groupOrdersFeature