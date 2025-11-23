/**
 * Group Orders Service
 * Business logic for group ordering functionality
 */

import { randomUUID } from 'crypto'
import type { D1Database } from '@cloudflare/workers-types'
// Mock shared utilities - will be replaced with actual implementations
class ConsoleLogger {
  constructor(private context: string, private level: string = 'info') {}
  info(message: string, data?: any) { console.log(`[${this.context}] ${message}`, data) }
  error(message: string, error: any) { console.error(`[${this.context}] ${message}`, error) }
}

class KVCacheService {
  constructor(private kv?: KVNamespace) {}
  async get(key: string) { return this.kv ? await this.kv.get(key, 'json') : null }
  async set(key: string, value: any, ttl?: number) {
    if (this.kv) await this.kv.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : undefined)
  }
  async delete(key: string) { if (this.kv) await this.kv.delete(key) }
}

class PerformanceMonitor {
  constructor(private context: string) {}
  startTimer(name: string) { return { name, start: Date.now() } }
  endTimer(timer: any) { console.log(`[${this.context}] ${timer.name} took ${Date.now() - timer.start}ms`) }
}

class ErrorTracker {
  constructor(private context: string) {}
  logError(operation: string, error: Error, data?: any) {
    console.error(`[${this.context}] Error in ${operation}:`, error, data)
  }
}
import type {
  IGroupOrderService,
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
  ActivityType
} from '../types'

export class GroupOrdersService implements IGroupOrderService {
  private db: D1Database
  private cache: KVCacheService
  private logger: ConsoleLogger
  private performance: PerformanceMonitor
  private errorTracker: ErrorTracker

  constructor(
    database: D1Database,
    cacheKV?: KVNamespace,
    logLevel: string = 'info'
  ) {
    this.db = database
    this.cache = new KVCacheService(cacheKV)
    this.logger = new ConsoleLogger('group-orders', logLevel)
    this.performance = new PerformanceMonitor('group-orders')
    this.errorTracker = new ErrorTracker('group-orders')
  }

  /**
   * Create a new group order
   */
  async createGroupOrder(
    data: CreateGroupOrderRequest,
    hostId: number
  ): Promise<{ success: boolean; data?: CreateGroupOrderResponse; error?: string }> {
    const timer = this.performance.startTimer('createGroupOrder')

    try {
      this.logger.info('Creating group order', { restaurantId: data.restaurantId, hostId })

      // Generate unique identifiers
      const groupOrderId = randomUUID()
      const shareCode = this.generateShareCode()
      const expiresAt = new Date(Date.now() + (data.expirationHours || 24) * 60 * 60 * 1000)

      // Default permissions
      const defaultPermissions = {
        canInviteMembers: true,
        canModifyOthersCart: false,
        canFinalizeOrder: true,
        canSplitBill: true,
        canProcessPayment: true,
        ...data.permissions
      }

      // Create group order
      const groupOrderResult = await this.db.prepare(`
        INSERT INTO group_orders (
          group_order_id, restaurant_id, table_id, share_code, created_by,
          status, expires_at, max_members, permissions, total_amount,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        groupOrderId,
        data.restaurantId,
        data.tableId || null,
        shareCode,
        hostId,
        'active',
        expiresAt.toISOString(),
        data.maxMembers || 8,
        JSON.stringify(defaultPermissions),
        0
      ).run()

      if (!groupOrderResult.success) {
        throw new Error('Failed to create group order')
      }

      // Create host member
      const hostMemberId = randomUUID()
      const hostMemberResult = await this.db.prepare(`
        INSERT INTO group_order_members (
          member_id, group_order_id, member_name, is_host, joined_at,
          total_amount, paid_amount, payment_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        hostMemberId,
        groupOrderId,
        'Host', // This should be updated with actual host name
        1, // is_host = true
        0, // initial total_amount
        0, // initial paid_amount
        'pending'
      ).run()

      if (!hostMemberResult.success) {
        throw new Error('Failed to create host member')
      }

      // Log activity
      await this.logActivity(groupOrderId, hostMemberId, 'group_created', 'Group order created', {
        shareCode,
        expiresAt: expiresAt.toISOString(),
        maxMembers: data.maxMembers || 8
      })

      // Get host member data
      const hostMember = await this.db.prepare(`
        SELECT * FROM group_order_members WHERE member_id = ?
      `).bind(hostMemberId).first() as any

      const response: CreateGroupOrderResponse = {
        groupOrderId,
        shareCode,
        expiresAt,
        host: this.formatMember(hostMember)
      }

      // Cache the group order
      await this.cache.set(`group_order:${groupOrderId}`, response, 3600)
      await this.cache.set(`share_code:${shareCode}`, groupOrderId, 3600)

      this.logger.info('Group order created successfully', { groupOrderId, shareCode })
      return { success: true, data: response }

    } catch (error) {
      this.errorTracker.logError('createGroupOrder', error as Error, { data, hostId })
      this.logger.error('Failed to create group order', error)
      return { success: false, error: 'Failed to create group order' }
    } finally {
      this.performance.endTimer(timer)
    }
  }

  /**
   * Join an existing group order
   */
  async joinGroup(
    shareCode: string,
    memberData: JoinGroupRequest
  ): Promise<{ success: boolean; data?: JoinGroupResponse; error?: string }> {
    const timer = this.performance.startTimer('joinGroup')

    try {
      this.logger.info('Member joining group', { shareCode, memberName: memberData.memberName })

      // Get group order by share code
      const groupOrder = await this.db.prepare(`
        SELECT * FROM group_orders WHERE share_code = ? AND status = 'active' AND expires_at > datetime('now')
      `).bind(shareCode).first() as any

      if (!groupOrder) {
        return { success: false, error: 'Group order not found or expired' }
      }

      // Check if group is full
      const memberCount = await this.db.prepare(`
        SELECT COUNT(*) as count FROM group_order_members
        WHERE group_order_id = ? AND left_at IS NULL
      `).bind(groupOrder.group_order_id).first() as any

      if (memberCount.count >= groupOrder.max_members) {
        return { success: false, error: 'Group order is full' }
      }

      // Check if member name already exists in this group
      const existingMember = await this.db.prepare(`
        SELECT * FROM group_order_members
        WHERE group_order_id = ? AND member_name = ? AND left_at IS NULL
      `).bind(groupOrder.group_order_id, memberData.memberName).first()

      if (existingMember) {
        return { success: false, error: 'Member name already exists in this group' }
      }

      // Create new member
      const memberId = randomUUID()
      const memberResult = await this.db.prepare(`
        INSERT INTO group_order_members (
          member_id, group_order_id, member_name, phone, email, is_host,
          joined_at, total_amount, paid_amount, payment_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        memberId,
        groupOrder.group_order_id,
        memberData.memberName,
        memberData.phone || null,
        memberData.email || null,
        0, // is_host = false
        0, // initial total_amount
        0, // initial paid_amount
        'pending'
      ).run()

      if (!memberResult.success) {
        throw new Error('Failed to create member')
      }

      // Log activity
      await this.logActivity(groupOrder.group_order_id, memberId, 'member_joined',
        `${memberData.memberName} joined the group`, { memberName: memberData.memberName })

      // Get the created member
      const newMember = await this.db.prepare(`
        SELECT * FROM group_order_members WHERE member_id = ?
      `).bind(memberId).first() as any

      const response: JoinGroupResponse = {
        member: this.formatMember(newMember),
        groupOrder: this.formatGroupOrder(groupOrder)
      }

      // Invalidate cache
      await this.cache.delete(`group_order:${groupOrder.group_order_id}`)

      this.logger.info('Member joined group successfully', {
        groupOrderId: groupOrder.group_order_id,
        memberId,
        memberName: memberData.memberName
      })

      return { success: true, data: response }

    } catch (error) {
      this.errorTracker.logError('joinGroup', error as Error, { shareCode, memberData })
      this.logger.error('Failed to join group', error)
      return { success: false, error: 'Failed to join group' }
    } finally {
      this.performance.endTimer(timer)
    }
  }

  /**
   * Get group order details with members and cart items
   */
  async getGroupOrder(groupOrderId: string): Promise<GroupOrderSummary | null> {
    const timer = this.performance.startTimer('getGroupOrder')

    try {
      // Try cache first
      const cached = await this.cache.get(`group_order_summary:${groupOrderId}`)
      if (cached) {
        return cached as GroupOrderSummary
      }

      // Get group order
      const groupOrder = await this.db.prepare(`
        SELECT * FROM group_orders WHERE group_order_id = ?
      `).bind(groupOrderId).first() as any

      if (!groupOrder) {
        return null
      }

      // Get members
      const members = await this.db.prepare(`
        SELECT * FROM group_order_members
        WHERE group_order_id = ? AND left_at IS NULL
        ORDER BY is_host DESC, joined_at ASC
      `).bind(groupOrderId).all() as any

      // Get cart items with menu item details
      const cartItems = await this.db.prepare(`
        SELECT
          goci.*,
          mi.name as menu_item_name,
          mi.price as menu_item_price,
          mi.image_url as menu_item_image_url
        FROM group_order_cart_items goci
        JOIN menu_items mi ON goci.menu_item_id = mi.id
        WHERE goci.group_order_id = ?
        ORDER BY goci.created_at ASC
      `).bind(groupOrderId).all() as any

      // Get recent activities
      const activities = await this.db.prepare(`
        SELECT * FROM group_order_activities
        WHERE group_order_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `).bind(groupOrderId).all() as any

      const summary: GroupOrderSummary = {
        groupOrder: this.formatGroupOrder(groupOrder),
        members: members.results.map((m: any) => this.formatMember(m)),
        cartItems: cartItems.results.map((item: any) => ({
          ...this.formatCartItem(item),
          menuItem: {
            id: item.menu_item_id,
            name: item.menu_item_name,
            price: item.menu_item_price,
            imageUrl: item.menu_item_image_url
          }
        })),
        totalAmount: groupOrder.total_amount,
        activities: activities.results.map((a: any) => this.formatActivity(a))
      }

      // Cache for 5 minutes
      await this.cache.set(`group_order_summary:${groupOrderId}`, summary, 300)

      return summary

    } catch (error) {
      this.errorTracker.logError('getGroupOrder', error as Error, { groupOrderId })
      this.logger.error('Failed to get group order', error)
      return null
    } finally {
      this.performance.endTimer(timer)
    }
  }

  /**
   * Add item to cart
   */
  async addCartItem(
    groupOrderId: string,
    itemData: AddCartItemRequest
  ): Promise<{ success: boolean; data?: GroupOrderCartItem; error?: string }> {
    const timer = this.performance.startTimer('addCartItem')

    try {
      // Validate group order and member
      const validation = await this.validateGroupOrderAndMember(groupOrderId, itemData.memberId)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      // Get menu item details
      const menuItem = await this.db.prepare(`
        SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?
      `).bind(itemData.menuItemId, validation.groupOrder.restaurant_id).first() as any

      if (!menuItem) {
        return { success: false, error: 'Menu item not found' }
      }

      // Calculate prices
      const unitPrice = menuItem.price
      const totalPrice = unitPrice * itemData.quantity

      // Create cart item
      const itemId = randomUUID()
      const result = await this.db.prepare(`
        INSERT INTO group_order_cart_items (
          item_id, group_order_id, member_id, menu_item_id, quantity,
          unit_price, total_price, customizations, special_instructions,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        itemId,
        groupOrderId,
        itemData.memberId,
        itemData.menuItemId,
        itemData.quantity,
        unitPrice,
        totalPrice,
        JSON.stringify(itemData.customizations || {}),
        itemData.specialInstructions || null
      ).run()

      if (!result.success) {
        throw new Error('Failed to add cart item')
      }

      // Update member's total amount
      await this.updateMemberTotal(groupOrderId, itemData.memberId)

      // Update group order total
      await this.updateGroupOrderTotal(groupOrderId)

      // Log activity
      await this.logActivity(groupOrderId, itemData.memberId, 'item_added',
        `Added ${itemData.quantity}x ${menuItem.name}`, {
          menuItemId: itemData.menuItemId,
          quantity: itemData.quantity,
          totalPrice
        })

      // Get the created item
      const cartItem = await this.db.prepare(`
        SELECT * FROM group_order_cart_items WHERE item_id = ?
      `).bind(itemId).first() as any

      // Invalidate cache
      await this.cache.delete(`group_order_summary:${groupOrderId}`)

      return { success: true, data: this.formatCartItem(cartItem) }

    } catch (error) {
      this.errorTracker.logError('addCartItem', error as Error, { groupOrderId, itemData })
      this.logger.error('Failed to add cart item', error)
      return { success: false, error: 'Failed to add cart item' }
    } finally {
      this.performance.endTimer(timer)
    }
  }

  /**
   * Update cart item
   */
  async updateCartItem(
    groupOrderId: string,
    itemId: string,
    updateData: UpdateCartItemRequest
  ): Promise<{ success: boolean; data?: GroupOrderCartItem; error?: string }> {
    const timer = this.performance.startTimer('updateCartItem')

    try {
      // Get existing cart item
      const existingItem = await this.db.prepare(`
        SELECT * FROM group_order_cart_items WHERE item_id = ? AND group_order_id = ?
      `).bind(itemId, groupOrderId).first() as any

      if (!existingItem) {
        return { success: false, error: 'Cart item not found' }
      }

      // Build update query dynamically
      const updates: string[] = []
      const values: any[] = []

      if (updateData.quantity !== undefined) {
        updates.push('quantity = ?', 'total_price = ?')
        values.push(updateData.quantity, existingItem.unit_price * updateData.quantity)
      }

      if (updateData.customizations !== undefined) {
        updates.push('customizations = ?')
        values.push(JSON.stringify(updateData.customizations))
      }

      if (updateData.specialInstructions !== undefined) {
        updates.push('special_instructions = ?')
        values.push(updateData.specialInstructions)
      }

      updates.push('updated_at = datetime(\'now\')')
      values.push(itemId, groupOrderId)

      const result = await this.db.prepare(`
        UPDATE group_order_cart_items
        SET ${updates.join(', ')}
        WHERE item_id = ? AND group_order_id = ?
      `).bind(...values).run()

      if (!result.success) {
        throw new Error('Failed to update cart item')
      }

      // Update totals
      await this.updateMemberTotal(groupOrderId, existingItem.member_id)
      await this.updateGroupOrderTotal(groupOrderId)

      // Log activity
      await this.logActivity(groupOrderId, existingItem.member_id, 'item_updated',
        'Updated cart item', { itemId, changes: updateData })

      // Get updated item
      const updatedItem = await this.db.prepare(`
        SELECT * FROM group_order_cart_items WHERE item_id = ?
      `).bind(itemId).first() as any

      // Invalidate cache
      await this.cache.delete(`group_order_summary:${groupOrderId}`)

      return { success: true, data: this.formatCartItem(updatedItem) }

    } catch (error) {
      this.errorTracker.logError('updateCartItem', error as Error, { groupOrderId, itemId, updateData })
      this.logger.error('Failed to update cart item', error)
      return { success: false, error: 'Failed to update cart item' }
    } finally {
      this.performance.endTimer(timer)
    }
  }

  /**
   * Remove cart item
   */
  async removeCartItem(
    groupOrderId: string,
    itemId: string,
    memberId: string
  ): Promise<{ success: boolean; error?: string }> {
    const timer = this.performance.startTimer('removeCartItem')

    try {
      // Verify item belongs to member
      const cartItem = await this.db.prepare(`
        SELECT * FROM group_order_cart_items
        WHERE item_id = ? AND group_order_id = ? AND member_id = ?
      `).bind(itemId, groupOrderId, memberId).first() as any

      if (!cartItem) {
        return { success: false, error: 'Cart item not found or not owned by member' }
      }

      // Delete the item
      const result = await this.db.prepare(`
        DELETE FROM group_order_cart_items WHERE item_id = ?
      `).bind(itemId).run()

      if (!result.success) {
        throw new Error('Failed to remove cart item')
      }

      // Update totals
      await this.updateMemberTotal(groupOrderId, memberId)
      await this.updateGroupOrderTotal(groupOrderId)

      // Log activity
      await this.logActivity(groupOrderId, memberId, 'item_removed', 'Removed cart item', { itemId })

      // Invalidate cache
      await this.cache.delete(`group_order_summary:${groupOrderId}`)

      return { success: true }

    } catch (error) {
      this.errorTracker.logError('removeCartItem', error as Error, { groupOrderId, itemId, memberId })
      this.logger.error('Failed to remove cart item', error)
      return { success: false, error: 'Failed to remove cart item' }
    } finally {
      this.performance.endTimer(timer)
    }
  }

  /**
   * Split bill among members
   */
  async splitBill(
    _groupOrderId: string,
    _splitData: SplitBillRequest
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Implementation for bill splitting logic
    return { success: true, data: {} }
  }

  /**
   * Process payment for a member
   */
  async processPayment(
    _groupOrderId: string,
    _memberId: string,
    _paymentData: ProcessPaymentRequest
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    // Implementation for payment processing logic
    return { success: true, data: {} }
  }

  /**
   * Leave group
   */
  async leaveGroup(
    _groupOrderId: string,
    _memberId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Implementation for leaving group logic
    return { success: true }
  }

  /**
   * Get group activities
   */
  async getActivities(groupOrderId: string): Promise<GroupOrderActivity[]> {
    const activities = await this.db.prepare(`
      SELECT * FROM group_order_activities
      WHERE group_order_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(groupOrderId).all() as any

    return activities.results.map((a: any) => this.formatActivity(a))
  }

  /**
   * Cleanup expired groups
   */
  async cleanupExpiredGroups(): Promise<{ cleaned: number; errors: string[] }> {
    // Implementation for cleanup logic
    return { cleaned: 0, errors: [] }
  }

  /**
   * Get statistics
   */
  async getStatistics(_restaurantId?: number, _timeRange?: string): Promise<GroupOrderStatistics> {
    // Implementation for statistics logic
    return {
      totalGroupOrders: 0,
      activeGroupOrders: 0,
      averageGroupSize: 0,
      averageOrderValue: 0,
      popularTimeSlots: [],
      conversionRate: 0,
      paymentMethodDistribution: {}
    }
  }

  // Helper methods
  private generateShareCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  private async validateGroupOrderAndMember(groupOrderId: string, memberId: string) {
    const groupOrder = await this.db.prepare(`
      SELECT * FROM group_orders WHERE group_order_id = ?
    `).bind(groupOrderId).first() as any

    if (!groupOrder) {
      return { valid: false, error: 'Group order not found' }
    }

    if (groupOrder.status !== 'active') {
      return { valid: false, error: 'Group order is not active' }
    }

    if (new Date(groupOrder.expires_at) < new Date()) {
      return { valid: false, error: 'Group order has expired' }
    }

    const member = await this.db.prepare(`
      SELECT * FROM group_order_members
      WHERE member_id = ? AND group_order_id = ? AND left_at IS NULL
    `).bind(memberId, groupOrderId).first() as any

    if (!member) {
      return { valid: false, error: 'Member not found in group' }
    }

    return { valid: true, groupOrder, member }
  }

  private async updateMemberTotal(groupOrderId: string, memberId: string) {
    const total = await this.db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as total
      FROM group_order_cart_items
      WHERE group_order_id = ? AND member_id = ?
    `).bind(groupOrderId, memberId).first() as any

    await this.db.prepare(`
      UPDATE group_order_members
      SET total_amount = ?, updated_at = datetime('now')
      WHERE member_id = ? AND group_order_id = ?
    `).bind(total.total, memberId, groupOrderId).run()
  }

  private async updateGroupOrderTotal(groupOrderId: string) {
    const total = await this.db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as total
      FROM group_order_cart_items
      WHERE group_order_id = ?
    `).bind(groupOrderId).first() as any

    await this.db.prepare(`
      UPDATE group_orders
      SET total_amount = ?, updated_at = datetime('now')
      WHERE group_order_id = ?
    `).bind(total.total, groupOrderId).run()
  }

  private async logActivity(
    groupOrderId: string,
    memberId: string | null,
    type: ActivityType,
    description: string,
    metadata?: Record<string, any>
  ) {
    const activityId = randomUUID()
    await this.db.prepare(`
      INSERT INTO group_order_activities (
        activity_id, group_order_id, member_id, type, description, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      activityId,
      groupOrderId,
      memberId,
      type,
      description,
      JSON.stringify(metadata || {})
    ).run()
  }

  private formatGroupOrder(data: any): GroupOrder {
    return {
      id: data.id,
      groupOrderId: data.group_order_id,
      restaurantId: data.restaurant_id,
      tableId: data.table_id,
      shareCode: data.share_code,
      createdBy: data.created_by,
      status: data.status as GroupOrderStatus,
      expiresAt: new Date(data.expires_at),
      maxMembers: data.max_members,
      permissions: JSON.parse(data.permissions || '{}'),
      totalAmount: data.total_amount,
      finalizedAt: data.finalized_at ? new Date(data.finalized_at) : undefined,
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }

  private formatMember(data: any): GroupOrderMember {
    return {
      id: data.id,
      memberId: data.member_id,
      groupOrderId: data.group_order_id,
      memberName: data.member_name,
      phone: data.phone,
      email: data.email,
      isHost: Boolean(data.is_host),
      joinedAt: new Date(data.joined_at),
      leftAt: data.left_at ? new Date(data.left_at) : undefined,
      totalAmount: data.total_amount,
      paidAmount: data.paid_amount,
      paymentStatus: data.payment_status as PaymentStatus,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }

  private formatCartItem(data: any): GroupOrderCartItem {
    return {
      id: data.id,
      itemId: data.item_id,
      groupOrderId: data.group_order_id,
      memberId: data.member_id,
      menuItemId: data.menu_item_id,
      quantity: data.quantity,
      unitPrice: data.unit_price,
      totalPrice: data.total_price,
      customizations: JSON.parse(data.customizations || '{}'),
      specialInstructions: data.special_instructions,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }

  private formatActivity(data: any): GroupOrderActivity {
    return {
      id: data.id,
      activityId: data.activity_id,
      groupOrderId: data.group_order_id,
      memberId: data.member_id,
      memberName: data.member_name,
      type: data.type as ActivityType,
      description: data.description,
      metadata: JSON.parse(data.metadata || '{}'),
      timestamp: new Date(data.created_at),
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    }
  }
}