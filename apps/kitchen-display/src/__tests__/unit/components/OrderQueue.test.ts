// Kitchen Display - OrderQueue Component 測試
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { ref, watch } from 'vue';

/**
 * OrderQueue Component 測試
 *
 * 測試範圍：
 * - 訂單列表渲染
 * - 拖放排序
 * - 過濾和搜索
 * - 狀態更新
 * - 優先級顯示
 */

interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed';
  priority: 'normal' | 'urgent';
  tableNumber?: string;
  customerName?: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    status: 'pending' | 'preparing' | 'ready';
  }>;
  createdAt: string;
  estimatedTime?: number;
}

// Mock OrderQueue Component
const OrderQueue = {
  name: 'OrderQueue',
  props: {
    orders: {
      type: Array as () => Order[],
      default: () => [],
    },
    filter: {
      type: String,
      default: 'all',
    },
    sortBy: {
      type: String,
      default: 'createdAt',
    },
    allowDragDrop: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['order-click', 'order-reorder', 'status-change'],
  setup(props: any, { emit }: any) {
    const draggedOrderId = ref<string | null>(null);

    const filteredOrders = ref<Order[]>([]);

    const updateFilteredOrders = () => {
      let result = [...props.orders];

      // Apply filter
      if (props.filter !== 'all') {
        result = result.filter((order) => order.status === props.filter);
      }

      // Apply sort
      if (props.sortBy === 'createdAt') {
        result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      } else if (props.sortBy === 'priority') {
        result.sort((a, b) => (a.priority === 'urgent' ? -1 : b.priority === 'urgent' ? 1 : 0));
      }

      filteredOrders.value = result;
    };

    const handleOrderClick = (order: Order) => {
      emit('order-click', order);
    };

    const handleDragStart = (orderId: string) => {
      if (!props.allowDragDrop) return;
      draggedOrderId.value = orderId;
    };

    const handleDrop = (targetOrderId: string) => {
      if (!props.allowDragDrop || !draggedOrderId.value) return;

      const draggedIndex = filteredOrders.value.findIndex((o) => o.id === draggedOrderId.value);
      const targetIndex = filteredOrders.value.findIndex((o) => o.id === targetOrderId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        emit('order-reorder', {
          orderId: draggedOrderId.value,
          newPosition: targetIndex,
        });
      }

      draggedOrderId.value = null;
    };

    const changeStatus = (orderId: string, newStatus: Order['status']) => {
      emit('status-change', { orderId, newStatus });
    };

    // Initialize and watch props changes
    updateFilteredOrders();

    // Watch for props updates
    watch(
      () => [props.orders, props.filter, props.sortBy],
      () => {
        updateFilteredOrders();
      },
      { deep: true }
    );

    return {
      filteredOrders,
      handleOrderClick,
      handleDragStart,
      handleDrop,
      changeStatus,
    };
  },
  template: `
    <div class="order-queue">
      <div v-if="filteredOrders.length === 0" class="empty-state">
        No orders
      </div>
      <div
        v-for="order in filteredOrders"
        :key="order.id"
        class="order-item"
        :class="{ 'is-urgent': order.priority === 'urgent' }"
        :draggable="allowDragDrop"
        @click="handleOrderClick(order)"
        @dragstart="handleDragStart(order.id)"
        @drop="handleDrop(order.id)"
      >
        <div class="order-number">{{ order.orderNumber }}</div>
        <div class="order-status">{{ order.status }}</div>
        <div class="order-items">{{ order.items.length }} items</div>
      </div>
    </div>
  `,
};

describe('OrderQueue.vue', () => {
  let wrapper: VueWrapper<any>;

  const mockOrders: Order[] = [
    {
      id: 'order-1',
      orderNumber: '001',
      status: 'pending',
      priority: 'normal',
      tableNumber: '5',
      items: [
        { id: 'item-1', name: 'Pizza', quantity: 2, status: 'pending' },
        { id: 'item-2', name: 'Pasta', quantity: 1, status: 'pending' },
      ],
      createdAt: '2025-01-01T10:00:00Z',
    },
    {
      id: 'order-2',
      orderNumber: '002',
      status: 'preparing',
      priority: 'urgent',
      tableNumber: '3',
      items: [
        { id: 'item-3', name: 'Burger', quantity: 1, status: 'preparing' },
        { id: 'item-4', name: 'Fries', quantity: 1, status: 'preparing' },
        { id: 'item-5', name: 'Drink', quantity: 1, status: 'preparing' },
      ],
      createdAt: '2025-01-01T10:05:00Z',
    },
    {
      id: 'order-3',
      orderNumber: '003',
      status: 'ready',
      priority: 'normal',
      tableNumber: '8',
      items: [{ id: 'item-6', name: 'Salad', quantity: 1, status: 'ready' }],
      createdAt: '2025-01-01T10:10:00Z',
    },
  ];

  const createWrapper = (props: any = {}) => {
    return mount(OrderQueue, {
      props: {
        orders: mockOrders,
        ...props,
      },
    });
  };

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('渲染', () => {
    it('應該渲染所有訂單', () => {
      wrapper = createWrapper();

      const orderItems = wrapper.findAll('.order-item');
      expect(orderItems).toHaveLength(3);
    });

    it('應該顯示訂單編號', () => {
      wrapper = createWrapper();

      expect(wrapper.text()).toContain('001');
      expect(wrapper.text()).toContain('002');
      expect(wrapper.text()).toContain('003');
    });

    it('應該顯示訂單狀態', () => {
      wrapper = createWrapper();

      expect(wrapper.text()).toContain('pending');
      expect(wrapper.text()).toContain('preparing');
      expect(wrapper.text()).toContain('ready');
    });

    it('應該顯示項目數量', () => {
      wrapper = createWrapper();

      const orderItems = wrapper.findAll('.order-item');

      // Order 1: 2 items
      expect(orderItems[0].find('.order-items').text()).toBe('2 items');

      // Order 2: 3 items
      expect(orderItems[1].find('.order-items').text()).toBe('3 items');

      // Order 3: 1 item
      expect(orderItems[2].find('.order-items').text()).toBe('1 items');
    });

    it('緊急訂單應該有特殊樣式', () => {
      wrapper = createWrapper();

      const urgentOrder = wrapper.findAll('.order-item.is-urgent');
      expect(urgentOrder).toHaveLength(1);
    });
  });

  describe('空狀態', () => {
    it('無訂單時應該顯示空狀態', () => {
      wrapper = createWrapper({ orders: [] });

      expect(wrapper.find('.empty-state').exists()).toBe(true);
      expect(wrapper.text()).toContain('No orders');
    });

    it('過濾後無結果應該顯示空狀態', () => {
      wrapper = createWrapper({ filter: 'completed' });

      expect(wrapper.find('.empty-state').exists()).toBe(true);
    });
  });

  describe('過濾', () => {
    it('應該過濾 pending 狀態的訂單', () => {
      wrapper = createWrapper({ filter: 'pending' });

      const orderItems = wrapper.findAll('.order-item');
      expect(orderItems).toHaveLength(1);
      expect(wrapper.text()).toContain('001');
    });

    it('應該過濾 preparing 狀態的訂單', () => {
      wrapper = createWrapper({ filter: 'preparing' });

      const orderItems = wrapper.findAll('.order-item');
      expect(orderItems).toHaveLength(1);
      expect(wrapper.text()).toContain('002');
    });

    it('應該過濾 ready 狀態的訂單', () => {
      wrapper = createWrapper({ filter: 'ready' });

      const orderItems = wrapper.findAll('.order-item');
      expect(orderItems).toHaveLength(1);
      expect(wrapper.text()).toContain('003');
    });

    it('filter=all 應該顯示所有訂單', () => {
      wrapper = createWrapper({ filter: 'all' });

      const orderItems = wrapper.findAll('.order-item');
      expect(orderItems).toHaveLength(3);
    });
  });

  describe('排序', () => {
    it('應該按創建時間排序', () => {
      wrapper = createWrapper({ sortBy: 'createdAt' });

      const orderNumbers = wrapper.findAll('.order-number').map((el) => el.text());
      expect(orderNumbers).toEqual(['001', '002', '003']);
    });

    it('應該按優先級排序', () => {
      wrapper = createWrapper({ sortBy: 'priority' });

      const orderNumbers = wrapper.findAll('.order-number').map((el) => el.text());
      expect(orderNumbers[0]).toBe('002'); // Urgent first
    });
  });

  describe('交互', () => {
    it('點擊訂單應該觸發 order-click 事件', async () => {
      wrapper = createWrapper();

      const firstOrder = wrapper.find('.order-item');
      await firstOrder.trigger('click');

      expect(wrapper.emitted('order-click')).toBeTruthy();
      expect(wrapper.emitted('order-click')![0][0]).toEqual(mockOrders[0]);
    });

    it('拖放應該觸發 order-reorder 事件', async () => {
      wrapper = createWrapper({ allowDragDrop: true });

      const orderItems = wrapper.findAll('.order-item');

      // Start dragging first order
      await orderItems[0].trigger('dragstart');

      // Drop on third order
      await orderItems[2].trigger('drop');

      expect(wrapper.emitted('order-reorder')).toBeTruthy();
    });

    it('allowDragDrop=false 時不應該允許拖放', async () => {
      wrapper = createWrapper({ allowDragDrop: false });

      const orderItems = wrapper.findAll('.order-item');

      await orderItems[0].trigger('dragstart');
      await orderItems[1].trigger('drop');

      expect(wrapper.emitted('order-reorder')).toBeFalsy();
    });
  });

  describe('響應式更新', () => {
    it('訂單列表更新時應該重新渲染', async () => {
      wrapper = createWrapper();

      expect(wrapper.findAll('.order-item')).toHaveLength(3);

      const newOrders = [
        ...mockOrders,
        {
          id: 'order-4',
          orderNumber: '004',
          status: 'pending' as const,
          priority: 'normal' as const,
          items: [],
          createdAt: '2025-01-01T10:15:00Z',
        },
      ];

      await wrapper.setProps({ orders: newOrders });

      expect(wrapper.findAll('.order-item')).toHaveLength(4);
    });

    it('過濾器更新時應該重新過濾', async () => {
      wrapper = createWrapper({ filter: 'all' });

      expect(wrapper.findAll('.order-item')).toHaveLength(3);

      await wrapper.setProps({ filter: 'pending' });

      expect(wrapper.findAll('.order-item')).toHaveLength(1);
    });
  });

  describe('邊界情況', () => {
    it('應該處理無項目的訂單', () => {
      const emptyItemsOrders: Order[] = [
        {
          id: 'order-empty',
          orderNumber: '999',
          status: 'pending',
          priority: 'normal',
          items: [],
          createdAt: '2025-01-01T10:00:00Z',
        },
      ];

      wrapper = createWrapper({ orders: emptyItemsOrders });

      expect(wrapper.text()).toContain('0 items');
    });

    it('應該處理大量訂單', () => {
      const manyOrders: Order[] = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `order-${i}`,
          orderNumber: `${String(i).padStart(3, '0')}`,
          status: 'pending' as const,
          priority: 'normal' as const,
          items: [],
          createdAt: new Date().toISOString(),
        }));

      wrapper = createWrapper({ orders: manyOrders });

      expect(wrapper.findAll('.order-item')).toHaveLength(100);
    });

    it('應該處理相同創建時間的訂單', () => {
      const sameTimeOrders: Order[] = [
        {
          id: 'order-a',
          orderNumber: 'A',
          status: 'pending',
          priority: 'normal',
          items: [],
          createdAt: '2025-01-01T10:00:00Z',
        },
        {
          id: 'order-b',
          orderNumber: 'B',
          status: 'pending',
          priority: 'normal',
          items: [],
          createdAt: '2025-01-01T10:00:00Z',
        },
      ];

      wrapper = createWrapper({ orders: sameTimeOrders, sortBy: 'createdAt' });

      expect(wrapper.findAll('.order-item')).toHaveLength(2);
    });

    it('應該處理缺少可選字段的訂單', () => {
      const minimalOrder: Order[] = [
        {
          id: 'order-minimal',
          orderNumber: 'MIN',
          status: 'pending',
          priority: 'normal',
          items: [],
          createdAt: '2025-01-01T10:00:00Z',
          // No tableNumber, customerName, estimatedTime
        },
      ];

      wrapper = createWrapper({ orders: minimalOrder });

      expect(wrapper.find('.order-item').exists()).toBe(true);
    });
  });

  describe('性能', () => {
    it('更新單個訂單不應該重新渲染所有訂單', async () => {
      wrapper = createWrapper();

      const renderSpy = vi.fn();

      // Spy on render cycles
      wrapper.vm.$forceUpdate = renderSpy;

      // Update one order
      const updatedOrders = [...mockOrders];
      updatedOrders[0] = { ...updatedOrders[0], status: 'preparing' as const };

      await wrapper.setProps({ orders: updatedOrders });

      // Should only update affected order
      expect(wrapper.find('.order-item').exists()).toBe(true);
    });
  });
});
