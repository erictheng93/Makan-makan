/**
 * useGroupOrder Composable Tests
 * 測試群組點餐功能的核心邏輯
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import type { GroupOrder, GroupMember, GroupCartItem, SplitBillConfig } from '../useGroupOrder'

// Mock dependencies
vi.mock('../useWebSocket', () => ({
  useWebSocket: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    send: vi.fn(),
    connectionStatus: ref('disconnected')
  })
}))

vi.mock('@/services/api', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

// Import after mocks are set up
const { useGroupOrder } = await import('../useGroupOrder')
const { apiClient } = await import('@/services/api')

describe('useGroupOrder', () => {
  const mockOptions = {
    restaurantId: 'rest_1',
    tableId: 'table_1',
    userId: 'user_1',
    userName: 'Test User'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('初始化', () => {
    it('應該正確初始化狀態', () => {
      const {
        groupOrder,
        isLoading,
        error,
        isConnected,
        isHost,
        myItems,
        totalAmount,
        myShare,
        onlineMembers
      } = useGroupOrder(mockOptions)

      expect(groupOrder.value).toBeNull()
      expect(isLoading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(isConnected.value).toBe(false)
      expect(isHost.value).toBe(false)
      expect(myItems.value).toEqual([])
      expect(totalAmount.value).toBe(0)
      expect(myShare.value).toBe(0)
      expect(onlineMembers.value).toEqual([])
    })
  })

  describe('createGroupOrder', () => {
    it('應該成功創建群組訂單', async () => {
      const mockApi = apiClient as any
      mockApi.post.mockResolvedValueOnce({ groupOrderId: 'go_123' })
      mockApi.get.mockResolvedValueOnce({
        id: 'go_123',
        restaurantId: 'rest_1',
        tableId: 'table_1',
        hostId: 'user_1',
        hostName: 'Test User',
        status: 'open',
        members: [],
        cartItems: [],
        splitBillConfig: { mode: 'equal' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
      mockApi.post.mockResolvedValueOnce({ token: 'ws_token_123' })

      const { createGroupOrder, groupOrder } = useGroupOrder(mockOptions)

      const result = await createGroupOrder()

      expect(result).toBe('go_123')
      expect(mockApi.post).toHaveBeenCalledWith('/group-orders', expect.objectContaining({
        restaurantId: 'rest_1',
        tableId: 'table_1',
        hostId: 'user_1',
        hostName: 'Test User'
      }))
    })

    it('應該處理創建失敗', async () => {
      const mockApi = apiClient as any
      mockApi.post.mockResolvedValueOnce(null)

      const { createGroupOrder, error } = useGroupOrder(mockOptions)

      const result = await createGroupOrder()

      expect(result).toBeNull()
      expect(error.value).toBe('Failed to create group order')
    })
  })

  describe('joinGroupOrder', () => {
    it('應該成功加入群組訂單', async () => {
      const mockGroupOrder: GroupOrder = {
        id: 'go_456',
        restaurantId: 'rest_1',
        tableId: 'table_1',
        hostId: 'user_2',
        hostName: 'Host User',
        status: 'open',
        members: [
          {
            id: 'user_2',
            name: 'Host User',
            isHost: true,
            isOnline: true,
            joinedAt: Date.now(),
            lastActivity: Date.now()
          }
        ],
        cartItems: [],
        splitBillConfig: { mode: 'equal' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const mockApi = apiClient as any
      mockApi.get.mockResolvedValueOnce(mockGroupOrder)
      mockApi.post.mockResolvedValueOnce({ token: 'ws_token_456' })

      const { joinGroupOrder, groupOrder } = useGroupOrder(mockOptions)

      const result = await joinGroupOrder('go_456')

      expect(result).toBe(true)
      expect(groupOrder.value).toEqual(mockGroupOrder)
    })
  })

  describe('購物車操作', () => {
    let groupOrderRef: any

    beforeEach(() => {
      groupOrderRef = ref<GroupOrder>({
        id: 'go_789',
        restaurantId: 'rest_1',
        tableId: 'table_1',
        hostId: 'user_1',
        hostName: 'Test User',
        status: 'open',
        members: [
          {
            id: 'user_1',
            name: 'Test User',
            isHost: true,
            isOnline: true,
            joinedAt: Date.now(),
            lastActivity: Date.now()
          }
        ],
        cartItems: [],
        splitBillConfig: { mode: 'equal' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    })

    it('addToCart 應該添加項目', () => {
      const { addToCart, groupOrder } = useGroupOrder(mockOptions)

      // 手動設置 groupOrder（模擬已加入）
      groupOrder.value = groupOrderRef.value

      const mockApi = apiClient as any
      mockApi.post.mockResolvedValue({ success: true })

      addToCart({
        menuItemId: 'item_1',
        menuItemName: 'Test Item',
        menuItemPrice: 100,
        quantity: 2
      })

      expect(groupOrder.value?.cartItems.length).toBe(1)
      expect(groupOrder.value?.cartItems[0].menuItemName).toBe('Test Item')
      expect(groupOrder.value?.cartItems[0].quantity).toBe(2)
      expect(groupOrder.value?.cartItems[0].addedBy).toBe('user_1')
    })

    it('updateCartItem 應該更新項目', () => {
      const { updateCartItem, groupOrder } = useGroupOrder(mockOptions)

      // 設置初始購物車
      groupOrder.value = {
        ...groupOrderRef.value,
        cartItems: [{
          id: 'cart_1',
          menuItemId: 'item_1',
          menuItemName: 'Test Item',
          menuItemPrice: 100,
          quantity: 1,
          addedBy: 'user_1',
          addedByName: 'Test User',
          addedAt: Date.now()
        }]
      }

      updateCartItem('cart_1', { quantity: 3 })

      expect(groupOrder.value?.cartItems[0].quantity).toBe(3)
    })

    it('removeFromCart 應該移除項目', () => {
      const { removeFromCart, groupOrder } = useGroupOrder(mockOptions)

      // 設置初始購物車
      groupOrder.value = {
        ...groupOrderRef.value,
        cartItems: [{
          id: 'cart_1',
          menuItemId: 'item_1',
          menuItemName: 'Test Item',
          menuItemPrice: 100,
          quantity: 1,
          addedBy: 'user_1',
          addedByName: 'Test User',
          addedAt: Date.now()
        }]
      }

      removeFromCart('cart_1')

      expect(groupOrder.value?.cartItems.length).toBe(0)
    })
  })

  describe('分帳計算', () => {
    const createMockGroupOrder = (
      splitBillConfig: SplitBillConfig,
      cartItems: GroupCartItem[],
      members: GroupMember[]
    ): GroupOrder => ({
      id: 'go_test',
      restaurantId: 'rest_1',
      tableId: 'table_1',
      hostId: 'user_1',
      hostName: 'Test User',
      status: 'open',
      members,
      cartItems,
      splitBillConfig,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })

    it('equal 模式應該平均分配', () => {
      const { groupOrder, totalAmount, myShare } = useGroupOrder(mockOptions)

      groupOrder.value = createMockGroupOrder(
        { mode: 'equal' },
        [
          {
            id: 'item_1',
            menuItemId: 'm1',
            menuItemName: 'Item 1',
            menuItemPrice: 100,
            quantity: 2,
            addedBy: 'user_1',
            addedByName: 'User 1',
            addedAt: Date.now()
          }
        ],
        [
          { id: 'user_1', name: 'User 1', isHost: true, isOnline: true, joinedAt: 0, lastActivity: 0 },
          { id: 'user_2', name: 'User 2', isHost: false, isOnline: true, joinedAt: 0, lastActivity: 0 }
        ]
      )

      expect(totalAmount.value).toBe(200) // 100 * 2
      expect(myShare.value).toBe(100) // 200 / 2 members
    })

    it('by_item 模式應該按各自點的計算', () => {
      const { groupOrder, myShare, myItems } = useGroupOrder(mockOptions)

      groupOrder.value = createMockGroupOrder(
        { mode: 'by_item' },
        [
          {
            id: 'item_1',
            menuItemId: 'm1',
            menuItemName: 'My Item',
            menuItemPrice: 150,
            quantity: 1,
            addedBy: 'user_1', // 我的項目
            addedByName: 'User 1',
            addedAt: Date.now()
          },
          {
            id: 'item_2',
            menuItemId: 'm2',
            menuItemName: 'Other Item',
            menuItemPrice: 200,
            quantity: 1,
            addedBy: 'user_2', // 別人的項目
            addedByName: 'User 2',
            addedAt: Date.now()
          }
        ],
        [
          { id: 'user_1', name: 'User 1', isHost: true, isOnline: true, joinedAt: 0, lastActivity: 0 },
          { id: 'user_2', name: 'User 2', isHost: false, isOnline: true, joinedAt: 0, lastActivity: 0 }
        ]
      )

      expect(myItems.value.length).toBe(1)
      expect(myShare.value).toBe(150) // 只有我的項目
    })

    it('custom 模式應該按自訂比例計算', () => {
      const { groupOrder, myShare, totalAmount } = useGroupOrder(mockOptions)

      groupOrder.value = createMockGroupOrder(
        {
          mode: 'custom',
          customShares: {
            'user_1': 30, // 30%
            'user_2': 70  // 70%
          }
        },
        [
          {
            id: 'item_1',
            menuItemId: 'm1',
            menuItemName: 'Item',
            menuItemPrice: 1000,
            quantity: 1,
            addedBy: 'user_1',
            addedByName: 'User 1',
            addedAt: Date.now()
          }
        ],
        [
          { id: 'user_1', name: 'User 1', isHost: true, isOnline: true, joinedAt: 0, lastActivity: 0 },
          { id: 'user_2', name: 'User 2', isHost: false, isOnline: true, joinedAt: 0, lastActivity: 0 }
        ]
      )

      expect(totalAmount.value).toBe(1000)
      expect(myShare.value).toBe(300) // 1000 * 30%
    })

    it('single_payer 模式應該由指定人支付全部', () => {
      const { groupOrder, myShare, totalAmount } = useGroupOrder(mockOptions)

      groupOrder.value = createMockGroupOrder(
        {
          mode: 'single_payer',
          singlePayerId: 'user_1' // 我付全部
        },
        [
          {
            id: 'item_1',
            menuItemId: 'm1',
            menuItemName: 'Item',
            menuItemPrice: 500,
            quantity: 2,
            addedBy: 'user_2',
            addedByName: 'User 2',
            addedAt: Date.now()
          }
        ],
        [
          { id: 'user_1', name: 'User 1', isHost: true, isOnline: true, joinedAt: 0, lastActivity: 0 },
          { id: 'user_2', name: 'User 2', isHost: false, isOnline: true, joinedAt: 0, lastActivity: 0 }
        ]
      )

      expect(totalAmount.value).toBe(1000)
      expect(myShare.value).toBe(1000) // 我是付款人
    })

    it('single_payer 非付款人應該是 0', () => {
      const { groupOrder, myShare } = useGroupOrder(mockOptions)

      groupOrder.value = createMockGroupOrder(
        {
          mode: 'single_payer',
          singlePayerId: 'user_2' // 別人付
        },
        [
          {
            id: 'item_1',
            menuItemId: 'm1',
            menuItemName: 'Item',
            menuItemPrice: 500,
            quantity: 2,
            addedBy: 'user_1',
            addedByName: 'User 1',
            addedAt: Date.now()
          }
        ],
        [
          { id: 'user_1', name: 'User 1', isHost: true, isOnline: true, joinedAt: 0, lastActivity: 0 },
          { id: 'user_2', name: 'User 2', isHost: false, isOnline: true, joinedAt: 0, lastActivity: 0 }
        ]
      )

      expect(myShare.value).toBe(0) // 我不是付款人
    })
  })

  describe('分帳模式設置', () => {
    it('setSplitBillMode 應該更新模式（僅限 host）', () => {
      const { groupOrder, setSplitBillMode, isHost } = useGroupOrder(mockOptions)

      groupOrder.value = {
        id: 'go_test',
        restaurantId: 'rest_1',
        tableId: 'table_1',
        hostId: 'user_1', // 我是 host
        hostName: 'Test User',
        status: 'open',
        members: [],
        cartItems: [],
        splitBillConfig: { mode: 'equal' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      expect(isHost.value).toBe(true)

      setSplitBillMode('by_item')

      expect(groupOrder.value?.splitBillConfig.mode).toBe('by_item')
    })
  })

  describe('getShareLink', () => {
    it('應該生成正確的分享連結', () => {
      const { groupOrder, getShareLink } = useGroupOrder(mockOptions)

      groupOrder.value = {
        id: 'go_share_test',
        restaurantId: 'rest_1',
        tableId: 'table_1',
        hostId: 'user_1',
        hostName: 'Test User',
        status: 'open',
        members: [],
        cartItems: [],
        splitBillConfig: { mode: 'equal' },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const link = getShareLink()

      expect(link).toContain('/group/go_share_test/join')
    })

    it('groupOrder 為 null 時應該返回空字串', () => {
      const { getShareLink } = useGroupOrder(mockOptions)

      const link = getShareLink()

      expect(link).toBe('')
    })
  })
})
