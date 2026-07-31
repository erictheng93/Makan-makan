/**
 * Group Order Composable
 * 群組點餐功能 - 處理即時購物車同步和分帳
 */

import { ref, computed, onUnmounted } from "vue";
import { useWebSocket } from "./useWebSocket";
import { apiClient } from "@/services/api";

// ============================================================================
// Types
// ============================================================================

export interface GroupMember {
  id: string;
  name: string;
  phone?: string;
  isHost: boolean;
  isOnline: boolean;
  joinedAt: number;
  lastActivity: number;
}

export interface GroupCartItem {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
  quantity: number;
  options?: Record<string, unknown>;
  notes?: string;
  addedBy: string;
  addedByName: string;
  addedAt: number;
}

export interface SplitBillConfig {
  mode: "equal" | "by_item" | "custom" | "single_payer";
  customShares?: Record<string, number>; // userId -> percentage or amount
  singlePayerId?: string;
}

export interface GroupOrder {
  id: string;
  restaurantId: string;
  tableId: string;
  hostId: string;
  hostName: string;
  status: "open" | "ordering" | "submitted" | "completed" | "cancelled";
  members: GroupMember[];
  cartItems: GroupCartItem[];
  splitBillConfig: SplitBillConfig;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface GroupOrderEvent {
  type: string;
  groupOrderId: string;
  data: unknown;
  senderId: string;
  senderName: string;
  timestamp: number;
}

// ============================================================================
// Composable
// ============================================================================

export function useGroupOrder(options: {
  restaurantId: string;
  tableId: string;
  userId: string;
  userName: string;
}) {
  const { restaurantId, tableId, userId, userName } = options;

  // State
  const groupOrder = ref<GroupOrder | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isConnected = ref(false);

  // WebSocket connection
  const {
    connect,
    disconnect,
    send: sendMessage,
    connectionStatus: _connectionStatus,
  } = useWebSocket();

  // Computed
  const isHost = computed(() => groupOrder.value?.hostId === userId);

  const myItems = computed(
    () =>
      groupOrder.value?.cartItems.filter((item) => item.addedBy === userId) ||
      [],
  );

  const totalAmount = computed(
    () =>
      groupOrder.value?.cartItems.reduce(
        (sum, item) => sum + item.menuItemPrice * item.quantity,
        0,
      ) || 0,
  );

  const myShare = computed(() => {
    if (!groupOrder.value) return 0;
    const config = groupOrder.value.splitBillConfig;

    switch (config.mode) {
      case "equal":
        const memberCount = groupOrder.value.members.length;
        return memberCount > 0 ? totalAmount.value / memberCount : 0;

      case "by_item":
        return myItems.value.reduce(
          (sum, item) => sum + item.menuItemPrice * item.quantity,
          0,
        );

      case "custom":
        const share = config.customShares?.[userId] || 0;
        return (totalAmount.value * share) / 100;

      case "single_payer":
        return config.singlePayerId === userId ? totalAmount.value : 0;

      default:
        return 0;
    }
  });

  const onlineMembers = computed(
    () => groupOrder.value?.members.filter((m) => m.isOnline) || [],
  );

  // Methods
  async function createGroupOrder(): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post<{ groupOrderId: string }>(
        "/group-orders",
        {
          restaurantId,
          tableId,
          hostId: userId,
          hostName: userName,
        },
      );

      if (response?.groupOrderId) {
        const groupOrderId = response.groupOrderId;
        await joinGroupOrder(groupOrderId);
        return groupOrderId;
      } else {
        throw new Error("Failed to create group order");
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Unknown error";
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function joinGroupOrder(groupOrderId: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      // Fetch group order details
      const response = await apiClient.get<GroupOrder>(
        `/group-orders/${groupOrderId}`,
      );

      if (response) {
        groupOrder.value = response;

        // Connect to WebSocket for real-time updates
        await connectToGroupOrder(groupOrderId);

        // Notify others about joining
        broadcastEvent("member_joined", {
          memberId: userId,
          memberName: userName,
        });

        return true;
      } else {
        throw new Error("Failed to join group order");
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Unknown error";
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function connectToGroupOrder(groupOrderId: string): Promise<void> {
    try {
      // NOTE: this call now fails by design. /realtime/auth/token is public and
      // no longer mints customer-room tokens — it could not verify the caller,
      // and `roomId` was never bound to `tableId`, so anyone could join
      // `customer:{groupOrderId}` and read every member's name, phone, and cart
      // (issue #96). Re-enabling group order realtime needs a membership proof
      // minted when a member joins, exchanged at a dedicated endpoint.
      // Do NOT re-add "customer" to webSocketTokenRequestSchema.
      const tokenResponse = await apiClient.post<{ token: string }>(
        "/realtime/auth/token",
        {
          roomType: "customer",
          roomId: groupOrderId,
          restaurantId,
          tableId,
        },
      );

      if (!tokenResponse) {
        throw new Error("Failed to get WebSocket token");
      }

      const token = tokenResponse.token;

      // Connect to WebSocket using URL string
      const realtimeUrl = import.meta.env.VITE_REALTIME_URL;
      if (!realtimeUrl) {
        throw new Error(
          "[Config Error] VITE_REALTIME_URL is required for group order WebSocket. " +
            "Please set this environment variable in your .env file.",
        );
      }
      const wsUrl = `${realtimeUrl}/customer/${groupOrderId}?token=${token}`;
      connect(wsUrl);

      isConnected.value = true;
      console.log("Connected to group order WebSocket");
    } catch (err: unknown) {
      console.error("Failed to connect to group order:", err);
      error.value = "Connection error";
      throw err;
    }
  }

  // Reserved for future WebSocket message handling
  function _handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as GroupOrderEvent;

      switch (data.type) {
        case "cart_item_added":
          handleCartItemAdded(data.data as GroupCartItem);
          break;

        case "cart_item_updated":
          handleCartItemUpdated(data.data as GroupCartItem);
          break;

        case "cart_item_removed":
          handleCartItemRemoved(data.data as { itemId: string });
          break;

        case "member_joined":
          handleMemberJoined(data.data as GroupMember);
          break;

        case "member_left":
          handleMemberLeft(data.data as { memberId: string });
          break;

        case "member_status_updated":
          handleMemberStatusUpdated(
            data.data as { memberId: string; isOnline: boolean },
          );
          break;

        case "split_bill_updated":
          handleSplitBillUpdated(data.data as SplitBillConfig);
          break;

        case "order_submitted":
          handleOrderSubmitted();
          break;

        default:
          console.log("Unknown event type:", data.type);
      }
    } catch (err) {
      console.error("Failed to handle WebSocket message:", err);
    }
  }

  function handleCartItemAdded(item: GroupCartItem): void {
    if (!groupOrder.value) return;
    groupOrder.value.cartItems.push(item);
    groupOrder.value.updatedAt = Date.now();
  }

  function handleCartItemUpdated(updatedItem: GroupCartItem): void {
    if (!groupOrder.value) return;
    const index = groupOrder.value.cartItems.findIndex(
      (i) => i.id === updatedItem.id,
    );
    if (index !== -1) {
      groupOrder.value.cartItems[index] = updatedItem;
      groupOrder.value.updatedAt = Date.now();
    }
  }

  function handleCartItemRemoved(data: { itemId: string }): void {
    if (!groupOrder.value) return;
    groupOrder.value.cartItems = groupOrder.value.cartItems.filter(
      (i) => i.id !== data.itemId,
    );
    groupOrder.value.updatedAt = Date.now();
  }

  function handleMemberJoined(member: GroupMember): void {
    if (!groupOrder.value) return;
    if (!groupOrder.value.members.find((m) => m.id === member.id)) {
      groupOrder.value.members.push(member);
    }
  }

  function handleMemberLeft(data: { memberId: string }): void {
    if (!groupOrder.value) return;
    groupOrder.value.members = groupOrder.value.members.filter(
      (m) => m.id !== data.memberId,
    );
  }

  function handleMemberStatusUpdated(data: {
    memberId: string;
    isOnline: boolean;
  }): void {
    if (!groupOrder.value) return;
    const member = groupOrder.value.members.find((m) => m.id === data.memberId);
    if (member) {
      member.isOnline = data.isOnline;
      member.lastActivity = Date.now();
    }
  }

  function handleSplitBillUpdated(config: SplitBillConfig): void {
    if (!groupOrder.value) return;
    groupOrder.value.splitBillConfig = config;
    groupOrder.value.updatedAt = Date.now();
  }

  function handleOrderSubmitted(): void {
    if (!groupOrder.value) return;
    groupOrder.value.status = "submitted";
  }

  function broadcastEvent(type: string, data: unknown): void {
    if (!groupOrder.value) return;

    const event: GroupOrderEvent = {
      type,
      groupOrderId: groupOrder.value.id,
      data,
      senderId: userId,
      senderName: userName,
      timestamp: Date.now(),
    };

    sendMessage(JSON.stringify(event));
  }

  // Cart operations
  function addToCart(
    item: Omit<GroupCartItem, "id" | "addedBy" | "addedByName" | "addedAt">,
  ): void {
    const cartItem: GroupCartItem = {
      ...item,
      id: crypto.randomUUID(),
      addedBy: userId,
      addedByName: userName,
      addedAt: Date.now(),
    };

    // Optimistic update
    handleCartItemAdded(cartItem);

    // Broadcast to others
    broadcastEvent("cart_item_added", cartItem);

    // Sync with server
    apiClient
      .post(`/group-orders/${groupOrder.value?.id}/cart`, cartItem)
      .catch((err: unknown) => {
        console.error("Failed to sync cart item:", err);
        // Rollback optimistic update
        handleCartItemRemoved({ itemId: cartItem.id });
      });
  }

  function updateCartItem(
    itemId: string,
    updates: Partial<GroupCartItem>,
  ): void {
    if (!groupOrder.value) return;

    const item = groupOrder.value.cartItems.find((i) => i.id === itemId);
    if (!item) return;

    // Only allow updating own items
    if (item.addedBy !== userId) {
      error.value = "You can only modify your own items";
      return;
    }

    const updatedItem = { ...item, ...updates };

    // Optimistic update
    handleCartItemUpdated(updatedItem);

    // Broadcast to others
    broadcastEvent("cart_item_updated", updatedItem);
  }

  function removeFromCart(itemId: string): void {
    if (!groupOrder.value) return;

    const item = groupOrder.value.cartItems.find((i) => i.id === itemId);
    if (!item) return;

    // Only allow removing own items (or host can remove any)
    if (item.addedBy !== userId && !isHost.value) {
      error.value = "You can only remove your own items";
      return;
    }

    // Optimistic update
    handleCartItemRemoved({ itemId });

    // Broadcast to others
    broadcastEvent("cart_item_removed", { itemId });
  }

  // Split bill operations
  function setSplitBillMode(mode: SplitBillConfig["mode"]): void {
    if (!groupOrder.value || !isHost.value) return;

    const config: SplitBillConfig = { mode };

    if (mode === "single_payer") {
      config.singlePayerId = userId;
    }

    handleSplitBillUpdated(config);
    broadcastEvent("split_bill_updated", config);
  }

  function setCustomShares(shares: Record<string, number>): void {
    if (!groupOrder.value || !isHost.value) return;

    const config: SplitBillConfig = {
      mode: "custom",
      customShares: shares,
    };

    handleSplitBillUpdated(config);
    broadcastEvent("split_bill_updated", config);
  }

  // Leave group order
  async function leaveGroupOrder(): Promise<void> {
    if (!groupOrder.value) return;

    broadcastEvent("member_left", { memberId: userId });
    disconnect();
    groupOrder.value = null;
    isConnected.value = false;
  }

  // Submit order (host only)
  async function submitOrder(): Promise<boolean> {
    if (!groupOrder.value || !isHost.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post(
        `/group-orders/${groupOrder.value.id}/submit`,
      );

      if (response) {
        handleOrderSubmitted();
        broadcastEvent("order_submitted", {});
        return true;
      } else {
        throw new Error("Failed to submit order");
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Unknown error";
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  // Generate share link/QR code
  function getShareLink(): string {
    if (!groupOrder.value) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/group/${groupOrder.value.id}/join`;
  }

  // Cleanup
  onUnmounted(() => {
    if (isConnected.value) {
      leaveGroupOrder();
    }
  });

  return {
    // State
    groupOrder,
    isLoading,
    error,
    isConnected,

    // Computed
    isHost,
    myItems,
    totalAmount,
    myShare,
    onlineMembers,

    // Methods
    createGroupOrder,
    joinGroupOrder,
    leaveGroupOrder,
    addToCart,
    updateCartItem,
    removeFromCart,
    setSplitBillMode,
    setCustomShares,
    submitOrder,
    getShareLink,
  };
}
