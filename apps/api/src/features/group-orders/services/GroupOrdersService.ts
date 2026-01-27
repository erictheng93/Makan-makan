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
      const expiresAt = Math.floor(Date.now() / 1000) + (data.expirationHours || 24) * 60 * 60

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
          id, restaurant_id, table_id, share_code, created_by,
          status, expires_at, settings, total_amount,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch('now'), unixepoch('now'))
      `).bind(
        groupOrderId,
        data.restaurantId,
        data.tableId || null,
        shareCode,
        hostId,
        'active',
        expiresAt,
        JSON.stringify({ maxMembers: data.maxMembers || 8, permissions: defaultPermissions }),
        0
      ).run()

      if (!groupOrderResult.success) {
        throw new Error('Failed to create group order')
      }

      // Create host member
      const hostMemberId = randomUUID()
      const sessionId = randomUUID() // Generate session ID for host
      const hostMemberResult = await this.db.prepare(`
        INSERT INTO group_members (
          id, group_order_id, session_id, name, role,
          joined_at, last_active_at, is_active
        ) VALUES (?, ?, ?, ?, ?, unixepoch('now'), unixepoch('now'), 1)
      `).bind(
        hostMemberId,
        groupOrderId,
        sessionId,
        'Host', // This should be updated with actual host name
        'creator' // role: creator for host
      ).run()

      if (!hostMemberResult.success) {
        throw new Error('Failed to create host member')
      }

      // Log activity
      await this.logActivity(groupOrderId, hostMemberId, 'group_created', 'Group order created', {
        shareCode,
        expiresAt,
        maxMembers: data.maxMembers || 8
      })

      // Get host member data
      const hostMember = await this.db.prepare(`
        SELECT * FROM group_members WHERE id = ?
      `).bind(hostMemberId).first() as any

      const response: CreateGroupOrderResponse = {
        groupOrderId,
        shareCode,
        expiresAt: new Date(expiresAt * 1000),
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
        SELECT * FROM group_orders
        WHERE share_code = ?
        AND status = 'active'
        AND expires_at > unixepoch('now')
      `).bind(shareCode).first() as any

      if (!groupOrder) {
        return { success: false, error: 'Group order not found or expired' }
      }

      // Parse settings to get maxMembers
      const settings = JSON.parse(groupOrder.settings || '{}')
      const maxMembers = settings.maxMembers || 8

      // Check if group is full
      const memberCount = await this.db.prepare(`
        SELECT COUNT(*) as count FROM group_members
        WHERE group_order_id = ? AND left_at IS NULL
      `).bind(groupOrder.id).first() as any

      if (memberCount.count >= maxMembers) {
        return { success: false, error: 'Group order is full' }
      }

      // Check if member name already exists in this group
      const existingMember = await this.db.prepare(`
        SELECT * FROM group_members
        WHERE group_order_id = ? AND name = ? AND left_at IS NULL
      `).bind(groupOrder.id, memberData.memberName).first()

      if (existingMember) {
        return { success: false, error: 'Member name already exists in this group' }
      }

      // Create new member
      const memberId = randomUUID()
      const sessionId = randomUUID() // Generate session ID for member
      const memberResult = await this.db.prepare(`
        INSERT INTO group_members (
          id, group_order_id, session_id, name, phone, email, role,
          joined_at, last_active_at, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch('now'), unixepoch('now'), 1)
      `).bind(
        memberId,
        groupOrder.id,
        sessionId,
        memberData.memberName,
        memberData.phone || null,
        memberData.email || null,
        'member' // role: member for non-host
      ).run()

      if (!memberResult.success) {
        throw new Error('Failed to create member')
      }

      // Log activity
      await this.logActivity(groupOrder.id, memberId, 'member_joined',
        `${memberData.memberName} joined the group`, { memberName: memberData.memberName })

      // Get the created member
      const newMember = await this.db.prepare(`
        SELECT * FROM group_members WHERE id = ?
      `).bind(memberId).first() as any

      const response: JoinGroupResponse = {
        member: this.formatMember(newMember),
        groupOrder: this.formatGroupOrder(groupOrder)
      }

      // Invalidate cache
      await this.cache.delete(`group_order:${groupOrder.id}`)

      this.logger.info('Member joined group successfully', {
        groupOrderId: groupOrder.id,
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
        SELECT * FROM group_orders WHERE id = ?
      `).bind(groupOrderId).first() as any

      if (!groupOrder) {
        return null
      }

      // Get members
      const members = await this.db.prepare(`
        SELECT * FROM group_members
        WHERE group_order_id = ? AND left_at IS NULL
        ORDER BY role DESC, joined_at ASC
      `).bind(groupOrderId).all() as any

      // Get cart items with menu item details
      const cartItems = await this.db.prepare(`
        SELECT
          gci.*,
          mi.name as menu_item_name,
          mi.price as menu_item_price,
          mi.image_url as menu_item_image_url
        FROM group_cart_items gci
        JOIN menu_items mi ON gci.menu_item_id = mi.id
        WHERE gci.group_order_id = ?
        ORDER BY gci.added_at ASC
      `).bind(groupOrderId).all() as any

      // Get recent activities
      const activities = await this.db.prepare(`
        SELECT * FROM group_activity_logs
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
      // Note: Using restaurantId from groupOrder
      const restaurantId = validation.groupOrder.restaurant_id
      const menuItem = await this.db.prepare(`
        SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?
      `).bind(itemData.menuItemId, restaurantId).first() as any

      if (!menuItem) {
        return { success: false, error: 'Menu item not found' }
      }

      // Calculate prices
      const unitPrice = menuItem.price
      const totalPrice = unitPrice * itemData.quantity

      // Create cart item
      const itemId = randomUUID()
      const result = await this.db.prepare(`
        INSERT INTO group_cart_items (
          id, group_order_id, member_id, menu_item_id, quantity,
          unit_price, total_price, customizations, special_instructions,
          status, added_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch('now'), unixepoch('now'))
      `).bind(
        itemId,
        groupOrderId,
        itemData.memberId,
        itemData.menuItemId,
        itemData.quantity,
        unitPrice,
        totalPrice,
        JSON.stringify(itemData.customizations || {}),
        itemData.specialInstructions || null,
        'active'
      ).run()

      if (!result.success) {
        throw new Error('Failed to add cart item')
      }

      // Update member's total amount (via split_bills)
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
        SELECT * FROM group_cart_items WHERE id = ?
      `).bind(itemId).first() as any

      if (!cartItem) {
        // Fallback: construct the response from the inserted data
        this.logger.error('Failed to query inserted cart item, using fallback', { itemId })
        const fallbackItem: GroupOrderCartItem = {
          id: 0, // Fallback ID when not available
          itemId: itemId,
          groupOrderId,
          memberId: itemData.memberId,
          menuItemId: itemData.menuItemId,
          quantity: itemData.quantity,
          unitPrice,
          totalPrice,
          customizations: itemData.customizations || {},
          specialInstructions: itemData.specialInstructions || undefined,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        // Invalidate cache
        await this.cache.delete(`group_order_summary:${groupOrderId}`)

        return { success: true, data: fallbackItem }
      }

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
        SELECT * FROM group_cart_items WHERE id = ? AND group_order_id = ?
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

      updates.push('updated_at = unixepoch(\'now\')')
      values.push(itemId, groupOrderId)

      const result = await this.db.prepare(`
        UPDATE group_cart_items
        SET ${updates.join(', ')}
        WHERE id = ? AND group_order_id = ?
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
        SELECT * FROM group_cart_items WHERE id = ?
      `).bind(itemId).first() as any

      if (!updatedItem) {
        throw new Error('Failed to query updated cart item')
      }

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
        SELECT * FROM group_cart_items
        WHERE id = ? AND group_order_id = ? AND member_id = ?
      `).bind(itemId, groupOrderId, memberId).first() as any

      if (!cartItem) {
        return { success: false, error: 'Cart item not found or not owned by member' }
      }

      // Delete the item
      const result = await this.db.prepare(`
        DELETE FROM group_cart_items WHERE id = ?
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
    groupOrderId: string,
    splitData: SplitBillRequest
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const timer = this.performance.startTimer('splitBill')

    try {
      this.logger.info('Splitting bill', { groupOrderId, splitType: splitData.splitType })

      // Validate group order exists and is active
      const groupOrder = await this.db.prepare(`
        SELECT * FROM group_orders WHERE id = ?
      `).bind(groupOrderId).first() as any

      if (!groupOrder) {
        return { success: false, error: 'Group order not found' }
      }

      if (groupOrder.status === 'completed' || groupOrder.status === 'cancelled') {
        return { success: false, error: 'Group order is already finalized' }
      }

      // Get all active members
      const members = await this.db.prepare(`
        SELECT * FROM group_members
        WHERE group_order_id = ? AND left_at IS NULL
        ORDER BY joined_at ASC
      `).bind(groupOrderId).all() as any

      if (!members.results || members.results.length === 0) {
        return { success: false, error: 'No active members found' }
      }

      // Get all active cart items
      const cartItems = await this.db.prepare(`
        SELECT * FROM group_cart_items
        WHERE group_order_id = ? AND status = 'active'
      `).bind(groupOrderId).all() as any

      const totalCartAmount = cartItems.results.reduce((sum: number, item: any) => sum + item.total_price, 0)

      const serviceChargeRate = splitData.serviceChargeRate || 0
      const taxRate = splitData.taxRate || 0

      const splitBills: Array<{
        memberId: string
        subtotal: number
        serviceCharge: number
        taxAmount: number
        totalAmount: number
        items: any[]
      }> = []

      // Calculate splits based on splitType
      if (splitData.splitType === 'by_item' || splitData.splitType === 'individual') {
        // Each member pays for their own items
        for (const member of members.results) {
          const memberItems = cartItems.results.filter((item: any) => item.member_id === member.id)
          const subtotal = memberItems.reduce((sum: number, item: any) => sum + item.total_price, 0)
          const serviceCharge = (subtotal * serviceChargeRate) / 100
          const taxAmount = ((subtotal + serviceCharge) * taxRate) / 100
          const totalAmount = subtotal + serviceCharge + taxAmount

          splitBills.push({
            memberId: member.id,
            subtotal,
            serviceCharge,
            taxAmount,
            totalAmount,
            items: memberItems.map((item: any) => ({
              itemId: item.id,
              menuItemId: item.menu_item_id,
              quantity: item.quantity,
              price: item.total_price
            }))
          })
        }
      } else if (splitData.splitType === 'equal') {
        // Split equally among all members
        const memberCount = members.results.length
        const subtotalPerMember = totalCartAmount / memberCount
        const serviceChargePerMember = (subtotalPerMember * serviceChargeRate) / 100
        const taxPerMember = ((subtotalPerMember + serviceChargePerMember) * taxRate) / 100
        const totalPerMember = subtotalPerMember + serviceChargePerMember + taxPerMember

        for (const member of members.results) {
          splitBills.push({
            memberId: member.id,
            subtotal: subtotalPerMember,
            serviceCharge: serviceChargePerMember,
            taxAmount: taxPerMember,
            totalAmount: totalPerMember,
            items: [] // Equal split doesn't track individual items
          })
        }
      } else if (splitData.splitType === 'custom') {
        // Use custom amounts
        if (!splitData.customAmounts || splitData.customAmounts.length === 0) {
          return { success: false, error: 'Custom amounts are required for custom split type' }
        }

        for (const customAmount of splitData.customAmounts) {
          const member = members.results.find((m: any) => m.id === customAmount.memberId)
          if (!member) {
            return { success: false, error: `Member ${customAmount.memberId} not found in group` }
          }

          const subtotal = customAmount.amount
          const serviceCharge = (subtotal * serviceChargeRate) / 100
          const taxAmount = ((subtotal + serviceCharge) * taxRate) / 100
          const totalAmount = subtotal + serviceCharge + taxAmount

          splitBills.push({
            memberId: member.id,
            subtotal,
            serviceCharge,
            taxAmount,
            totalAmount,
            items: [] // Custom split doesn't track individual items
          })
        }
      } else {
        return { success: false, error: `Unsupported split type: ${splitData.splitType}` }
      }

      // Insert split bills into database
      for (const bill of splitBills) {
        const billId = randomUUID()
        await this.db.prepare(`
          INSERT INTO split_bills (
            id, group_order_id, member_id, subtotal, tax_amount,
            service_charge, total_amount, items, payment_status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch('now'), unixepoch('now'))
        `).bind(
          billId,
          groupOrderId,
          bill.memberId,
          bill.subtotal,
          bill.taxAmount,
          bill.serviceCharge,
          bill.totalAmount,
          JSON.stringify(bill.items),
          'pending'
        ).run()
      }

      // Calculate final amounts for group order
      const totalServiceCharge = splitBills.reduce((sum, bill) => sum + bill.serviceCharge, 0)
      const totalTax = splitBills.reduce((sum, bill) => sum + bill.taxAmount, 0)
      const finalAmount = splitBills.reduce((sum, bill) => sum + bill.totalAmount, 0)

      // Map split types to database values ('by_item' -> 'individual')
      const dbSplitType = splitData.splitType === 'by_item' ? 'individual' : splitData.splitType

      // Update group order with split info and status
      await this.db.prepare(`
        UPDATE group_orders
        SET
          status = ?,
          split_type = ?,
          total_amount = ?,
          tax_amount = ?,
          service_charge = ?,
          final_amount = ?,
          locked_at = unixepoch('now'),
          updated_at = unixepoch('now')
        WHERE id = ?
      `).bind(
        'checkout',
        dbSplitType,
        totalCartAmount,
        totalTax,
        totalServiceCharge,
        finalAmount,
        groupOrderId
      ).run()

      // Log activity
      await this.logActivity(
        groupOrderId,
        null,
        'bill_split',
        `Bill split using ${splitData.splitType} method`,
        {
          splitType: splitData.splitType,
          memberCount: members.results.length,
          totalAmount: finalAmount
        }
      )

      // Invalidate cache
      await this.cache.delete(`group_order:${groupOrderId}`)
      await this.cache.delete(`group_order_summary:${groupOrderId}`)

      this.logger.info('Bill split successfully', {
        groupOrderId,
        splitType: splitData.splitType,
        billCount: splitBills.length,
        finalAmount
      })

      return {
        success: true,
        data: splitBills.map(bill => ({
          memberId: bill.memberId,
          subtotal: bill.subtotal,
          serviceCharge: bill.serviceCharge,
          taxAmount: bill.taxAmount,
          totalAmount: bill.totalAmount,
          items: bill.items
        }))
      }

    } catch (error) {
      this.errorTracker.logError('splitBill', error as Error, { groupOrderId, splitData })
      this.logger.error('Failed to split bill', error)
      return { success: false, error: 'Failed to split bill' }
    } finally {
      this.performance.endTimer(timer)
    }
  }

  /**
   * Process payment for a member
   */
  async processPayment(
    groupOrderId: string,
    memberId: string,
    paymentData: ProcessPaymentRequest
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const timer = this.performance.startTimer('processPayment')

    try {
      this.logger.info('Processing payment', { groupOrderId, memberId })

      // Validate group order exists
      const groupOrder = await this.db.prepare(`
        SELECT * FROM group_orders WHERE id = ?
      `).bind(groupOrderId).first() as any

      if (!groupOrder) {
        return { success: false, error: 'Group order not found' }
      }

      // Validate member exists
      const member = await this.db.prepare(`
        SELECT * FROM group_members
        WHERE id = ? AND group_order_id = ? AND left_at IS NULL
      `).bind(memberId, groupOrderId).first() as any

      if (!member) {
        return { success: false, error: 'Member not found in group' }
      }

      // Get the split bill for this member
      const splitBill = await this.db.prepare(`
        SELECT * FROM split_bills
        WHERE group_order_id = ? AND member_id = ?
      `).bind(groupOrderId, memberId).first() as any

      if (!splitBill) {
        return { success: false, error: 'Split bill not found for member. Please split the bill first.' }
      }

      // Check if already paid
      if (splitBill.payment_status === 'paid') {
        return { success: false, error: 'Payment already processed for this member' }
      }

      // Use provided amount or the split bill total
      const amount = paymentData.amount || splitBill.total_amount

      // Validate amount matches split bill (with small tolerance for rounding)
      if (Math.abs(amount - splitBill.total_amount) > 0.01) {
        return {
          success: false,
          error: `Payment amount (${amount}) does not match split bill amount (${splitBill.total_amount})`
        }
      }

      // Generate transaction reference if not provided
      const transactionId = paymentData.transactionId || `TXN-${Date.now()}-${randomUUID().substring(0, 8)}`

      // Store payment details as JSON
      const paymentReference = JSON.stringify({
        transactionId,
        method: paymentData.paymentMethod,
        details: paymentData.paymentDetails || {},
        processedAt: new Date().toISOString()
      })

      // Update split bill with payment info
      await this.db.prepare(`
        UPDATE split_bills
        SET
          payment_status = ?,
          payment_method = ?,
          payment_reference = ?,
          paid_at = unixepoch('now'),
          updated_at = unixepoch('now')
        WHERE id = ?
      `).bind(
        'paid',
        paymentData.paymentMethod,
        paymentReference,
        splitBill.id
      ).run()

      // Check if all members have paid
      const unpaidMembers = await this.db.prepare(`
        SELECT COUNT(*) as count FROM split_bills
        WHERE group_order_id = ? AND payment_status != 'paid'
      `).bind(groupOrderId).first() as any

      // If all paid, update group order status to completed
      if (unpaidMembers.count === 0) {
        await this.db.prepare(`
          UPDATE group_orders
          SET
            status = ?,
            completed_at = unixepoch('now'),
            updated_at = unixepoch('now')
          WHERE id = ?
        `).bind('completed', groupOrderId).run()
      }

      // Log activity
      await this.logActivity(
        groupOrderId,
        memberId,
        'payment_made',
        `${member.name} completed payment of ${amount}`,
        {
          amount,
          paymentMethod: paymentData.paymentMethod,
          transactionId
        }
      )

      // Invalidate cache
      await this.cache.delete(`group_order:${groupOrderId}`)
      await this.cache.delete(`group_order_summary:${groupOrderId}`)

      this.logger.info('Payment processed successfully', {
        groupOrderId,
        memberId,
        amount,
        transactionId
      })

      return {
        success: true,
        data: {
          memberId,
          amount,
          paymentMethod: paymentData.paymentMethod,
          transactionId,
          paidAt: new Date(),
          groupOrderStatus: unpaidMembers.count === 0 ? 'completed' : groupOrder.status
        }
      }

    } catch (error) {
      this.errorTracker.logError('processPayment', error as Error, { groupOrderId, memberId, paymentData })
      this.logger.error('Failed to process payment', error)
      return { success: false, error: 'Failed to process payment' }
    } finally {
      this.performance.endTimer(timer)
    }
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
      SELECT * FROM group_activity_logs
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
  async getStatistics(restaurantId?: string, timeRange?: string): Promise<GroupOrderStatistics> {
    try {
      // Calculate time range
      const now = Math.floor(Date.now() / 1000)
      let startTime = 0

      switch (timeRange) {
        case 'day':
          startTime = now - (24 * 60 * 60)
          break
        case 'week':
          startTime = now - (7 * 24 * 60 * 60)
          break
        case 'month':
          startTime = now - (30 * 24 * 60 * 60)
          break
        case 'quarter':
          startTime = now - (90 * 24 * 60 * 60)
          break
        case 'year':
          startTime = now - (365 * 24 * 60 * 60)
          break
        default:
          startTime = now - (30 * 24 * 60 * 60) // Default to month
      }

      // Build WHERE clause
      let whereClause = 'WHERE created_at >= ?'
      const params: any[] = [startTime]

      if (restaurantId) {
        whereClause += ' AND restaurant_id = ?'
        params.push(restaurantId)
      }

      // Get total group orders
      const totalResult = await this.db.prepare(`
        SELECT COUNT(*) as total FROM group_orders ${whereClause}
      `).bind(...params).first() as any

      // Get active group orders
      const activeResult = await this.db.prepare(`
        SELECT COUNT(*) as active FROM group_orders
        ${whereClause} AND status = 'active'
      `).bind(...params).first() as any

      // Get average group size
      const avgSizeResult = await this.db.prepare(`
        SELECT AVG(member_count) as avg_size FROM (
          SELECT group_order_id, COUNT(*) as member_count
          FROM group_members gm
          JOIN group_orders go ON gm.group_order_id = go.id
          ${whereClause.replace('created_at', 'go.created_at')}
          GROUP BY group_order_id
        )
      `).bind(...params).first() as any

      // Get average order value
      const avgValueResult = await this.db.prepare(`
        SELECT AVG(final_amount) as avg_value FROM group_orders
        ${whereClause} AND final_amount > 0
      `).bind(...params).first() as any

      return {
        totalGroupOrders: totalResult?.total || 0,
        activeGroupOrders: activeResult?.active || 0,
        averageGroupSize: Math.round((avgSizeResult?.avg_size || 0) * 10) / 10,
        averageOrderValue: Math.round((avgValueResult?.avg_value || 0) * 100) / 100,
        popularTimeSlots: [],
        conversionRate: totalResult?.total > 0
          ? Math.round(((totalResult.total - (activeResult?.active || 0)) / totalResult.total) * 100)
          : 0,
        paymentMethodDistribution: {}
      }
    } catch (error) {
      this.errorTracker.logError('getStatistics', error as Error, { restaurantId, timeRange })
      this.logger.error('Failed to get statistics', error)
      // Return default values on error
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
      SELECT * FROM group_orders WHERE id = ?
    `).bind(groupOrderId).first() as any

    if (!groupOrder) {
      return { valid: false, error: 'Group order not found' }
    }

    if (groupOrder.status !== 'active') {
      return { valid: false, error: 'Group order is not active' }
    }

    const now = Math.floor(Date.now() / 1000)
    if (groupOrder.expires_at < now) {
      return { valid: false, error: 'Group order has expired' }
    }

    const member = await this.db.prepare(`
      SELECT * FROM group_members
      WHERE id = ? AND group_order_id = ? AND left_at IS NULL
    `).bind(memberId, groupOrderId).first() as any

    if (!member) {
      return { valid: false, error: 'Member not found in group' }
    }

    return { valid: true, groupOrder, member }
  }

  private async updateMemberTotal(groupOrderId: string, memberId: string) {
    const total = await this.db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as total
      FROM group_cart_items
      WHERE group_order_id = ? AND member_id = ? AND status = 'active'
    `).bind(groupOrderId, memberId).first() as any

    // Update or create split_bill record for this member
    await this.db.prepare(`
      INSERT INTO split_bills (
        id, group_order_id, member_id, subtotal, total_amount,
        payment_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, unixepoch('now'), unixepoch('now'))
      ON CONFLICT(group_order_id, member_id) DO UPDATE SET
        subtotal = ?,
        total_amount = ?,
        updated_at = unixepoch('now')
    `).bind(
      randomUUID(),
      groupOrderId,
      memberId,
      total.total,
      total.total,
      'pending',
      total.total,
      total.total
    ).run()
  }

  private async updateGroupOrderTotal(groupOrderId: string) {
    const total = await this.db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as total
      FROM group_cart_items
      WHERE group_order_id = ? AND status = 'active'
    `).bind(groupOrderId).first() as any

    await this.db.prepare(`
      UPDATE group_orders
      SET total_amount = ?, updated_at = unixepoch('now')
      WHERE id = ?
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
      INSERT INTO group_activity_logs (
        id, group_order_id, member_id, action, description, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, unixepoch('now'))
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
    const settings = JSON.parse(data.settings || '{}')
    return {
      id: data.id,
      groupOrderId: data.id, // Keep for backward compatibility
      restaurantId: data.restaurant_id,
      tableId: data.table_id,
      shareCode: data.share_code,
      createdBy: data.created_by,
      status: data.status as GroupOrderStatus,
      expiresAt: new Date(data.expires_at * 1000), // Convert Unix timestamp to Date
      maxMembers: settings.maxMembers || 8,
      permissions: settings.permissions || {},
      totalAmount: data.total_amount,
      finalizedAt: data.locked_at ? new Date(data.locked_at * 1000) : undefined,
      paidAt: data.completed_at ? new Date(data.completed_at * 1000) : undefined,
      createdAt: new Date(data.created_at * 1000),
      updatedAt: new Date(data.updated_at * 1000)
    }
  }

  private formatMember(data: any): GroupOrderMember {
    return {
      id: data.id,
      memberId: data.id, // Keep for backward compatibility
      groupOrderId: data.group_order_id,
      memberName: data.name,
      phone: data.phone,
      email: data.email,
      isHost: data.role === 'creator', // Convert role to isHost
      joinedAt: new Date(data.joined_at * 1000),
      leftAt: data.left_at ? new Date(data.left_at * 1000) : undefined,
      totalAmount: 0, // Will be calculated from split_bills
      paidAmount: 0, // Will be calculated from split_bills
      paymentStatus: 'pending' as PaymentStatus,
      createdAt: new Date(data.joined_at * 1000),
      updatedAt: new Date(data.last_active_at * 1000)
    }
  }

  private formatCartItem(data: any): GroupOrderCartItem {
    return {
      id: data.id,
      itemId: data.id, // Keep for backward compatibility
      groupOrderId: data.group_order_id,
      memberId: data.member_id,
      menuItemId: data.menu_item_id,
      quantity: data.quantity,
      unitPrice: data.unit_price,
      totalPrice: data.total_price,
      customizations: JSON.parse(data.customizations || '{}'),
      specialInstructions: data.special_instructions,
      createdAt: new Date(data.added_at * 1000),
      updatedAt: new Date(data.updated_at * 1000)
    }
  }

  private formatActivity(data: any): GroupOrderActivity {
    return {
      id: data.id,
      activityId: data.id, // Keep for backward compatibility
      groupOrderId: data.group_order_id,
      memberId: data.member_id,
      memberName: '', // Not stored in activity logs
      type: data.action as ActivityType,
      description: data.description,
      metadata: JSON.parse(data.metadata || '{}'),
      timestamp: new Date(data.created_at * 1000),
      createdAt: new Date(data.created_at * 1000),
      updatedAt: new Date(data.created_at * 1000)
    }
  }
}
