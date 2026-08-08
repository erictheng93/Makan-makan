/**
 * Group Order Composable
 * 群組點餐功能 - 處理即時購物車同步和分帳
 */

import { ref, computed, onUnmounted } from "vue";
import { useWebSocket } from "./useWebSocket";
import { apiClient } from "@/services/api";
import {
  RealtimeEventType,
  type GroupOrderFeeMode,
  type GroupOrderStatus,
} from "@makanmakan/shared-types";
import {
  clearHostCredentials,
  clearMemberCredentials,
  readHostCredentials,
  readMemberCredentials,
  saveHostCredentials,
  saveMemberCredentials,
  updateHostMemberToken,
} from "@/utils/groupOrderSession";

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

/**
 * Only the methods the server can carry out at finalize on its own. `custom`
 * and `single_payer` need per-member amounts that a group order has nowhere to
 * store, so they are not offered as a preference.
 */
export interface SplitBillConfig {
  mode: "equal" | "by_item" | "proportional";
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
  /** Who carries the service charge and tax. Host-controlled. */
  feeMode: GroupOrderFeeMode;
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
  autoSubmitOnExpiry?: boolean;
  feeMode?: GroupOrderFeeMode;
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

interface RecoverHostResponse {
  memberToken: string;
}

interface SubmitGroupOrderResponse {
  masterOrderId?: string;
  status?: GroupOrderStatus;
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

interface GroupOrderRealtimeMessage {
  type?: unknown;
  data?: unknown;
}

interface GroupOrderRealtimePayload {
  groupOrderId?: unknown;
  item?: unknown;
  itemId?: unknown;
  member?: unknown;
}

interface MemberSession {
  groupOrderId: string;
  memberId: string;
  memberToken: string;
}

const memberSessions = new Map<string, MemberSession>();

function saveMemberSession(session: MemberSession): void {
  memberSessions.set(session.groupOrderId, session);
  saveMemberCredentials(session);
}

function readMemberSession(groupOrderId: string): MemberSession | null {
  const session = memberSessions.get(groupOrderId);
  if (session) return session;

  const stored = readMemberCredentials(groupOrderId);
  if (!stored) return null;

  const restored = {
    groupOrderId: stored.groupOrderId,
    memberId: stored.memberId,
    memberToken: stored.memberToken,
  };
  memberSessions.set(groupOrderId, restored);
  return restored;
}

function clearMemberSession(groupOrderId: string): void {
  memberSessions.delete(groupOrderId);
  clearMemberCredentials(groupOrderId);
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
  // `by_item` is the fallback for anything unrecognised, including the older
  // stored values this app no longer offers — never for a mode the host did
  // pick, which is why every offered mode is listed here.
  const splitMode: SplitBillConfig["mode"] =
    summary.groupOrder.splitType === "equal" ||
    summary.groupOrder.splitType === "proportional" ||
    summary.groupOrder.splitType === "by_item"
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
    feeMode: summary.groupOrder.feeMode ?? "proportional",
    createdAt: timestamp(summary.groupOrder.createdAt),
    updatedAt: timestamp(summary.groupOrder.updatedAt),
    expiresAt: timestamp(summary.groupOrder.expiresAt),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function asRealtimePayload(data: unknown): GroupOrderRealtimePayload {
  return isObject(data) ? data : {};
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
  const sessionExpired = ref(false);
  const currentMemberId = ref(userId);
  /**
   * This member's group order credential (`memberToken`), returned exactly once
   * by create/join. It is what buys a realtime token — keep it in memory only.
   */
  const memberToken = ref<string | null>(null);
  const recoveryCode = ref<string | null>(null);
  /**
   * Whether expiry turns the shared cart into a real order. Off unless the
   * host turns it on — see the toggle in GroupOrderView.
   */
  const autoSubmitOnExpiry = ref(false);

  function handleRealtimeMessage(message: GroupOrderRealtimeMessage): void {
    if (!groupOrder.value || typeof message.type !== "string") return;

    const payload = asRealtimePayload(message.data);
    if (payload.groupOrderId !== groupOrder.value.id) return;

    switch (message.type) {
      case RealtimeEventType.GROUP_CART_ITEM_ADDED:
        if (isObject(payload.item)) {
          handleCartItemAdded(
            mapCartItem(
              payload.item as unknown as BackendGroupCartItem,
              groupOrder.value.members,
            ),
          );
        }
        break;

      case RealtimeEventType.GROUP_CART_ITEM_UPDATED:
        if (isObject(payload.item)) {
          handleCartItemUpdated(
            mapCartItem(
              payload.item as unknown as BackendGroupCartItem,
              groupOrder.value.members,
            ),
          );
        }
        break;

      case RealtimeEventType.GROUP_CART_ITEM_REMOVED:
        if (typeof payload.itemId === "string") {
          handleCartItemRemoved({ itemId: payload.itemId });
        }
        break;

      case RealtimeEventType.GROUP_MEMBER_JOINED:
        if (isObject(payload.member)) {
          handleMemberJoined(
            mapMember(payload.member as unknown as BackendGroupMember),
          );
        }
        break;

      case RealtimeEventType.GROUP_ORDER_CREATED:
      default:
        break;
    }
  }

  // WebSocket connection
  const {
    connect,
    disconnect,
    connectionStatus: _connectionStatus,
  } = useWebSocket({
    onMessage: handleRealtimeMessage,
  });

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
      case "equal": {
        const memberCount = groupOrder.value.members.length;
        return memberCount > 0 ? totalAmount.value / memberCount : 0;
      }

      // Both come to the same number here. They diverge only once tax and
      // service charge are applied, and those rates live on the server — this
      // is a preview of the cart, not the final bill.
      case "by_item":
      case "proportional":
        return myItems.value.reduce(
          (sum, item) => sum + item.menuItemPrice * item.quantity,
          0,
        );

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
        saveHostCredentials({
          groupOrderId,
          memberToken: response.memberToken,
          memberId: currentMemberId.value,
          recoveryCode: response.recoveryCode,
        });
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
  async function joinGroupOrder(
    shareCode: string,
    memberName = userName,
  ): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await apiClient.post<JoinGroupOrderResponse>(
        `/orders/group/join/${shareCode}`,
        {
          memberName,
        },
      );

      if (!response?.memberToken) {
        throw new Error("Failed to join group order");
      }

      memberToken.value = response.memberToken;
      currentMemberId.value = response.member.memberId ?? response.member.id;
      saveMemberSession({
        groupOrderId: response.groupOrder.id,
        memberId: currentMemberId.value,
        memberToken: response.memberToken,
      });
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
      autoSubmitOnExpiry.value = summary.groupOrder.autoSubmitOnExpiry === true;
      hydrateMemberSession(groupOrderId);
      hydrateHostCredentials(groupOrderId);
    }
  }

  async function connectToGroupOrder(groupOrderId: string): Promise<void> {
    try {
      hydrateMemberSession(groupOrderId);
      hydrateHostCredentials(groupOrderId);
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
      sessionExpired.value = false;
      console.log("Connected to group order WebSocket");
    } catch (err: unknown) {
      console.error("Failed to connect to group order:", err);
      if (isAuthError(err)) {
        sessionExpired.value = true;
        error.value = "Host session expired. Recover host access to continue.";
      } else {
        error.value = "Connection error";
      }
      throw err;
    }
  }

  function hydrateHostCredentials(groupOrderId: string): void {
    if (memberToken.value) return;

    const credentials = readHostCredentials(groupOrderId);
    if (!credentials) return;

    memberToken.value = credentials.memberToken;
    recoveryCode.value = credentials.recoveryCode;
    if (credentials.memberId) {
      currentMemberId.value = credentials.memberId;
    } else if (
      groupOrder.value?.id === groupOrderId &&
      groupOrder.value.hostId
    ) {
      currentMemberId.value = groupOrder.value.hostId;
    }
  }

  function hydrateMemberSession(groupOrderId: string): void {
    if (memberToken.value) return;

    const session = readMemberSession(groupOrderId);
    if (!session) return;

    memberToken.value = session.memberToken;
    currentMemberId.value = session.memberId;
  }

  function isAuthError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const status = (err as { status?: unknown }).status;
    return status === 401 || status === 403;
  }

  function handleCartItemAdded(item: GroupCartItem): void {
    if (!groupOrder.value) return;
    if (
      groupOrder.value.cartItems.some((existing) => existing.id === item.id)
    ) {
      handleCartItemUpdated(item);
      return;
    }
    groupOrder.value.cartItems.push(item);
    groupOrder.value.updatedAt = Date.now();
  }

  function handleCartItemUpdated(updatedItem: GroupCartItem): void {
    if (!groupOrder.value) return;
    const index = groupOrder.value.cartItems.findIndex(
      (i) => i.id === updatedItem.id,
    );
    if (index !== -1) {
      const existingItem = groupOrder.value.cartItems[index];
      groupOrder.value.cartItems[index] = {
        ...existingItem,
        ...updatedItem,
        menuItemName: updatedItem.menuItemName || existingItem.menuItemName,
        addedByName: updatedItem.addedByName || existingItem.addedByName,
      };
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

  // Cart operations
  async function addToCart(
    item: Omit<GroupCartItem, "id" | "addedBy" | "addedByName" | "addedAt">,
  ): Promise<void> {
    if (!groupOrder.value) return;

    const cartItem = await apiClient.post<BackendGroupCartItem>(
      `/orders/group/${groupOrder.value.id}/cart`,
      {
        memberId: currentMemberId.value || groupOrder.value.hostId,
        memberToken: memberToken.value,
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
        memberId: currentMemberId.value || groupOrder.value.hostId,
        memberToken: memberToken.value,
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
      {
        memberId: currentMemberId.value || groupOrder.value.hostId,
        memberToken: memberToken.value,
      },
    );
    handleCartItemRemoved({ itemId });
  }

  // Split bill operations
  /**
   * Host only. Records who carries the service charge and tax — the food is
   * divided by `setSplitBillMode`, this is the fee on top of it.
   */
  async function setFeeMode(mode: GroupOrderFeeMode): Promise<void> {
    if (!groupOrder.value) {
      throw new Error("No group order loaded");
    }

    const groupOrderId = groupOrder.value.id;
    hydrateHostCredentials(groupOrderId);
    if (!memberToken.value) {
      throw new Error("Host credential is required to change this setting");
    }

    await apiClient.put(`/orders/group/${groupOrderId}/fee-mode`, {
      feeMode: mode,
      memberToken: memberToken.value,
    });
    await loadGroupOrder(groupOrderId);
  }

  /**
   * Host only. Records how finalize should divide the bill — it does not
   * perform the split, so the table keeps ordering afterwards.
   */
  async function setSplitBillMode(
    mode: SplitBillConfig["mode"],
  ): Promise<void> {
    if (!groupOrder.value) {
      throw new Error("No group order loaded");
    }

    const groupOrderId = groupOrder.value.id;
    hydrateHostCredentials(groupOrderId);
    if (!memberToken.value) {
      throw new Error("Host credential is required to change the split method");
    }

    await apiClient.put(`/orders/group/${groupOrderId}/split-type`, {
      splitType: mode,
      memberToken: memberToken.value,
    });
    await loadGroupOrder(groupOrderId);
  }

  // Leave group order
  async function leaveGroupOrder(): Promise<void> {
    if (!groupOrder.value) return;

    const groupOrderId = groupOrder.value.id;
    await apiClient.post(
      `/orders/group/${groupOrderId}/leave/${currentMemberId.value}`,
      {
        memberToken: memberToken.value,
      },
    );
    disconnect();
    clearMemberSession(groupOrderId);
    if (isHost.value) {
      clearHostCredentials(groupOrderId);
    }
    groupOrder.value = null;
    isConnected.value = false;
    memberToken.value = null;
    recoveryCode.value = null;
  }

  function disconnectRealtime(): void {
    disconnect();
    isConnected.value = false;
  }

  /**
   * Host only. The local flag is set from the server's answer rather than
   * optimistically, so a refusal leaves the toggle showing what is actually
   * true — telling a host their table is covered when it is not is worse than
   * a slow toggle.
   */
  async function setAutoSubmitOnExpiry(enabled: boolean): Promise<void> {
    if (!groupOrder.value) {
      throw new Error("No group order loaded");
    }

    const groupOrderId = groupOrder.value.id;
    hydrateHostCredentials(groupOrderId);
    if (!memberToken.value) {
      throw new Error("Host credential is required to change this setting");
    }

    await apiClient.put(`/orders/group/${groupOrderId}/auto-submit`, {
      enabled,
      memberToken: memberToken.value,
    });
    autoSubmitOnExpiry.value = enabled;
  }

  // Submit order (host only)
  async function submitOrder(): Promise<void> {
    if (!groupOrder.value) {
      throw new Error("No group order loaded");
    }

    const groupOrderId = groupOrder.value.id;
    hydrateHostCredentials(groupOrderId);
    if (!memberToken.value) {
      throw new Error("Host credential is required to submit this group order");
    }

    try {
      await apiClient.post<SubmitGroupOrderResponse>(
        `/orders/group/${groupOrderId}/lock`,
        {
          memberToken: memberToken.value,
        },
      );
      await loadGroupOrder(groupOrderId);
    } catch (submitError) {
      if (isForbiddenError(submitError)) {
        throw annotateError(submitError, { isHostOnly: true });
      }

      if (isBadRequestError(submitError)) {
        await loadGroupOrder(groupOrderId);
        if (groupOrder.value?.status === "finalizing_failed") {
          throw annotateError(submitError, { orderAlreadyPlaced: true });
        }
      }

      throw submitError;
    }
  }

  function isForbiddenError(err: unknown): boolean {
    return getErrorStatus(err) === 403;
  }

  function isBadRequestError(err: unknown): boolean {
    return getErrorStatus(err) === 400;
  }

  function getErrorStatus(err: unknown): unknown {
    return err && typeof err === "object"
      ? (err as { status?: unknown }).status
      : undefined;
  }

  function annotateError<T extends Record<string, boolean>>(
    err: unknown,
    flags: T,
  ): Error & T {
    const error = err instanceof Error ? err : new Error("Group order failed");
    return Object.assign(error, flags);
  }

  async function recoverHost(
    groupOrderId: string,
    code: string,
  ): Promise<void> {
    const normalizedCode = code.trim().toLowerCase();
    if (!normalizedCode) {
      throw new Error("Recovery code is required");
    }

    const response = await apiClient.post<RecoverHostResponse>(
      `/orders/group/${groupOrderId}/recover`,
      {
        recoveryCode: normalizedCode,
      },
    );

    if (!response?.memberToken) {
      throw new Error("Failed to recover host session");
    }

    const storedRecoveryCode =
      readHostCredentials(groupOrderId)?.recoveryCode ?? normalizedCode;
    saveHostCredentials({
      groupOrderId,
      memberToken: response.memberToken,
      memberId: groupOrder.value?.hostId,
      recoveryCode: storedRecoveryCode,
    });
    updateHostMemberToken(groupOrderId, response.memberToken);

    disconnectRealtime();
    memberToken.value = response.memberToken;
    recoveryCode.value = storedRecoveryCode;
    sessionExpired.value = false;
    await loadGroupOrder(groupOrderId);
    if (groupOrder.value?.id === groupOrderId && groupOrder.value.hostId) {
      currentMemberId.value = groupOrder.value.hostId;
    }
    await connectToGroupOrder(groupOrderId);
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
      disconnectRealtime();
    }
  });

  return {
    // State
    groupOrder,
    isLoading,
    error,
    isConnected,
    sessionExpired,
    currentMemberId,
    recoveryCode,
    autoSubmitOnExpiry,

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
    disconnectRealtime,
    leaveGroupOrder,
    addToCart,
    updateCartItem,
    removeFromCart,
    setSplitBillMode,
    setFeeMode,
    submitOrder,
    setAutoSubmitOnExpiry,
    recoverHost,
    getShareLink,
  };
}
