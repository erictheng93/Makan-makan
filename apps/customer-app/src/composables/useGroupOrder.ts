/**
 * Group Order Composable
 * 群組點餐功能 - 處理即時購物車同步和分帳
 */

import { ref, computed, onUnmounted } from "vue";
import { useWebSocket } from "./useWebSocket";
import { apiClient } from "@/services/api";
import type { GroupOrderStatus } from "@makanmakan/shared-types";

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
  tableId?: string;
  shareCode?: string;
  hostId: string;
  hostName: string;
  status: GroupOrderStatus;
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

interface CreateGroupOrderOptions {
  hostName?: string;
  tableId?: string;
}

interface CreateGroupOrderResponse {
  groupOrderId: string;
  shareCode: string;
  expiresAt: string;
  host: BackendGroupMember;
  memberToken: string;
  recoveryCode: string;
}

interface BackendGroupOrder {
  id: string;
  restaurantId: string;
  tableId?: number | string | null;
  shareCode?: string;
  createdBy?: string | null;
  status: GroupOrderStatus;
  splitType?: "equal" | "proportional" | "individual" | "by_item" | "custom";
  expiresAt?: string | Date | number | null;
  createdAt?: string | Date | number;
  updatedAt?: string | Date | number;
}

interface BackendGroupMember {
  id: string;
  memberId?: string;
  memberName: string;
  phone?: string;
  isHost: boolean;
  joinedAt: string | Date | number;
  lastActiveAt?: string | Date | number | null;
}

interface JoinGroupOrderResponse {
  member: BackendGroupMember;
  groupOrder: BackendGroupOrder;
  memberToken: string;
}

interface BackendGroupCartItem {
  id: string;
  itemId?: string;
  memberId: string;
  menuItemId: number;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  customizations?: Record<string, unknown>;
  specialInstructions?: string;
  addedAt?: string | Date | number;
  menuItem?: {
    id: number;
    name: string;
    price: number;
  };
}

interface GroupOrderSummary {
  groupOrder: BackendGroupOrder;
  members: BackendGroupMember[];
  cartItems: BackendGroupCartItem[];
}

function timestamp(value: string | Date | number | null | undefined): number {
  if (value == null) return Date.now();
  if (typeof value === "number") return value;
  return new Date(value).getTime();
}

function mapMember(member: BackendGroupMember): GroupMember {
  return {
    id: member.memberId ?? member.id,
    name: member.memberName,
    phone: member.phone,
    isHost: member.isHost,
    isOnline: true,
    joinedAt: timestamp(member.joinedAt),
    lastActivity: timestamp(member.lastActiveAt ?? member.joinedAt),
  };
}

function mapCartItem(
  item: BackendGroupCartItem,
  members: GroupMember[],
): GroupCartItem {
  const member = members.find((candidate) => candidate.id === item.memberId);

  return {
    id: item.itemId ?? item.id,
    menuItemId: String(item.menuItem?.id ?? item.menuItemId),
    menuItemName: item.menuItem?.name ?? "",
    menuItemPrice: item.menuItem?.price ?? item.unitPrice ?? 0,
    quantity: item.quantity,
    options: item.customizations,
    notes: item.specialInstructions,
    addedBy: item.memberId,
    addedByName: member?.name ?? "",
    addedAt: timestamp(item.addedAt),
  };
}

function mapSummary(summary: GroupOrderSummary): GroupOrder {
  const members = summary.members.map(mapMember);
  const host = members.find((member) => member.isHost);
  const splitMode =
    summary.groupOrder.splitType === "equal" ||
    summary.groupOrder.splitType === "custom"
      ? summary.groupOrder.splitType
      : "by_item";

  return {
    id: summary.groupOrder.id,
    restaurantId: summary.groupOrder.restaurantId,
    tableId:
      summary.groupOrder.tableId == null
        ? undefined
        : String(summary.groupOrder.tableId),
    shareCode: summary.groupOrder.shareCode,
    hostId: host?.id ?? "",
    hostName: host?.name ?? "",
    status: summary.groupOrder.status,
    members,
    cartItems: summary.cartItems.map((item) => mapCartItem(item, members)),
    splitBillConfig: { mode: splitMode },
    createdAt: timestamp(summary.groupOrder.createdAt),
    updatedAt: timestamp(summary.groupOrder.updatedAt),
    expiresAt: timestamp(summary.groupOrder.expiresAt),
  };
}

// ============================================================================
// Composable
// ============================================================================

export function useGroupOrder(options: {
  restaurantId: string;
  tableId?: string;
  userId?: string;
  userName?: string;
}) {
  const { restaurantId, tableId, userId = "", userName = "" } = options;

  // State
  const groupOrder = ref<GroupOrder | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isConnected = ref(false);
  const currentMemberId = ref(userId);
  /**
   * This member's group order credential (`memberToken`), returned exactly once
   * by create/join. It is what buys a realtime token — keep it in memory only.
   */
  const memberToken = ref<string | null>(null);
  const recoveryCode = ref<string | null>(null);

  // WebSocket connection
  const {
    connect,
    disconnect,
    connectionStatus: _connectionStatus,
  } = useWebSocket();

  // Computed
  const isHost = computed(
    () => groupOrder.value?.hostId === currentMemberId.value,
  );

  const myItems = computed(
    () =>
      groupOrder.value?.cartItems.filter(
        (item) => item.addedBy === currentMemberId.value,
      ) || [],
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
        const share = config.customShares?.[currentMemberId.value] || 0;
        return (totalAmount.value * share) / 100;

      case "single_payer":
        return config.singlePayerId === currentMemberId.value
          ? totalAmount.value
          : 0;

      default:
        return 0;
    }
  });

  const onlineMembers = computed(
    () => groupOrder.value?.members.filter((m) => m.isOnline) || [],
  );

  // Methods
  async function createGroupOrder(
    createOptions: CreateGroupOrderOptions = {},
  ): Promise<string | null> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post<CreateGroupOrderResponse>(
        "/orders/group/create",
        {
          restaurantId,
          tableId: createOptions.tableId ?? tableId,
          hostName: createOptions.hostName ?? userName,
        },
      );

      if (response?.groupOrderId) {
        memberToken.value = response.memberToken;
        recoveryCode.value = response.recoveryCode;
        currentMemberId.value = response.host.memberId ?? response.host.id;
        const groupOrderId = response.groupOrderId;
        await loadGroupOrder(groupOrderId, response);
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

  /**
   * Join via share code. This is the only way a non-host obtains a
   * memberToken, so it must run before any realtime connection is attempted.
   */
  async function joinGroupOrder(shareCode: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post<JoinGroupOrderResponse>(
        `/orders/group/join/${shareCode}`,
        {
          memberName: userName,
        },
      );

      if (!response?.memberToken) {
        throw new Error("Failed to join group order");
      }

      memberToken.value = response.memberToken;
      currentMemberId.value = response.member.memberId ?? response.member.id;
      await loadGroupOrder(response.groupOrder.id);

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Unknown error";
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function loadGroupOrder(
    groupOrderId: string,
    createResponse?: CreateGroupOrderResponse,
  ): Promise<void> {
    const summary = await apiClient.get<GroupOrderSummary>(
      `/orders/group/${groupOrderId}`,
    );
    if (summary) {
      groupOrder.value = {
        ...mapSummary(summary),
        shareCode: summary.groupOrder.shareCode ?? createResponse?.shareCode,
      };
    }
  }

  async function connectToGroupOrder(groupOrderId: string): Promise<void> {
    try {
      if (!memberToken.value) {
        // Without a membership credential there is no way to prove this client
        // belongs in the room. The public token endpoint deliberately refuses
        // customer rooms — it could not verify the caller, so anyone could read
        // every member's name, phone, and cart (issue #96).
        throw new Error(
          "Not a member of this group order — create or join it first",
        );
      }

      const tokenResponse = await apiClient.post<{ token: string }>(
        "/realtime/auth/group-token",
        {
          groupOrderId,
          memberToken: memberToken.value,
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
    groupOrder.value.status = "checkout";
  }

  // Cart operations
  async function addToCart(
    item: Omit<GroupCartItem, "id" | "addedBy" | "addedByName" | "addedAt">,
  ): Promise<void> {
    if (!groupOrder.value) return;

    const cartItem = await apiClient.post<BackendGroupCartItem>(
      `/orders/group/${groupOrder.value.id}/cart`,
      {
        memberId: currentMemberId.value || groupOrder.value.hostId,
        menuItemId: Number(item.menuItemId),
        quantity: item.quantity,
        customizations: item.options ?? {},
        specialInstructions: item.notes,
      },
    );

    handleCartItemAdded(mapCartItem(cartItem, groupOrder.value.members));
  }

  async function updateCartItem(
    itemId: string,
    updates: Partial<GroupCartItem>,
  ): Promise<void> {
    if (!groupOrder.value) return;

    const updatedItem = await apiClient.put<BackendGroupCartItem>(
      `/orders/group/${groupOrder.value.id}/cart/${itemId}`,
      {
        quantity: updates.quantity,
        customizations: updates.options,
        specialInstructions: updates.notes,
      },
    );

    handleCartItemUpdated(mapCartItem(updatedItem, groupOrder.value.members));
  }

  async function removeFromCart(itemId: string): Promise<void> {
    if (!groupOrder.value) return;

    await apiClient.delete(
      `/orders/group/${groupOrder.value.id}/cart/${itemId}`,
    );
    handleCartItemRemoved({ itemId });
  }

  // Split bill operations
  async function setSplitBillMode(
    _mode: SplitBillConfig["mode"],
  ): Promise<never> {
    throw new Error("setSplitBillMode is not yet available");
  }

  async function setCustomShares(
    _shares: Record<string, number>,
  ): Promise<never> {
    throw new Error("setCustomShares is not yet available");
  }

  // Leave group order
  async function leaveGroupOrder(): Promise<void> {
    if (!groupOrder.value) return;

    await apiClient.post(
      `/orders/group/${groupOrder.value.id}/leave/${currentMemberId.value}`,
    );
    disconnect();
    groupOrder.value = null;
    isConnected.value = false;
  }

  // Submit order (host only)
  async function submitOrder(): Promise<never> {
    throw new Error("submitOrder is not yet available");
  }

  // Generate share link/QR code
  function getShareLink(): string {
    if (!groupOrder.value) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/group/${groupOrder.value.shareCode}`;
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
    recoveryCode,

    // Computed
    isHost,
    myItems,
    totalAmount,
    myShare,
    onlineMembers,

    // Methods
    createGroupOrder,
    joinGroupOrder,
    loadGroupOrder,
    connectToGroupOrder,
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
