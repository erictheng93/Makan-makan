# Group Ordering — Phase B: Collaborative Cart + Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the customer-app frontend actually usable for group ordering — join a group via a link/QR, see everyone's cart update live, add/edit/remove your own items — by fixing the frontend's contract with the real backend, not by building new backend cart endpoints (they already work).

**Architecture:** The backend side of cart collaboration is **already complete and correct**: `POST/PUT/DELETE /orders/group/:id/cart[/:itemId]` all work today and already broadcast `RealtimeEventType.GROUP_CART_ITEM_*` events over the existing `customer:{groupOrderId}` Durable Object room (verified in `apps/api/src/features/group-orders/routes/index.ts`). The gap is entirely in `apps/customer-app`: `useGroupOrder.ts` was built against an imagined backend (wrong URL prefixes, a client-side peer-broadcast model instead of listening to server-pushed events, mismatched status vocabulary) and neither it nor `GroupCartPanel.vue` is reachable from any route. This phase rewrites the composable's data layer to match the real API and real event model, and wires it into the app.

**Tech Stack:** Vue 3 Composition API, `apiClient` (axios-based, `apps/customer-app/src/services/api.ts`), the existing `useWebSocket` composable, Vue Router.

## Global Constraints

- `GroupCartPanel.vue`'s prop contract (`GroupCartItem`, `GroupMember`, `SplitBillConfig` — all currently exported from `useGroupOrder.ts`) does **not** change in this phase — it's a working, presentational component. The composable's job is to keep producing those same shapes while sourcing them correctly.
- No client-to-client peer broadcasting of cart mutations. The server is the only source of truth; the client mutates via REST and receives confirmation/fan-out via the server-pushed realtime event, never by echoing its own optimistic broadcast to "other clients" over the socket directly.
- Every REST call in the rewritten composable must hit a path that actually exists: `/orders/group/create`, `/orders/group/join/:shareCode`, `/orders/group/join/:shareCode` (GET, preview — Phase A), `/orders/group/:id`, `/orders/group/:id/cart`, `/orders/group/:id/cart/:itemId` (PUT/DELETE), `/realtime/auth/group-token`. Never `/group-orders/...` (that prefix 404s).
- Follow existing test conventions: local builders, `data-testid`/text-content assertions (never CSS class assertions), verify mock calls with `toHaveBeenCalledWith(expect.objectContaining(...))`.

---

## Current code this phase touches (verified 2026-08-04)

- `apps/customer-app/src/composables/useGroupOrder.ts` (572 lines) — exports `GroupMember`, `GroupCartItem`, `SplitBillConfig`, `GroupOrder`, `GroupOrderEvent` types (**keep these**) and a `useGroupOrder()` function whose internals need rewriting:
  - `createGroup`/`joinGroup`/`fetchGroupOrder details` (~lines 150-230) already call the *correct* paths (`/orders/group/create`, `/orders/group/join/:shareCode`, `/orders/group/:id`) and the correct realtime auth path (`/realtime/auth/group-token`, line ~240) — but the response shapes they map from don't match the real backend response shapes (see Task 1).
  - `addToCart` (~line 397) posts to `/group-orders/${id}/cart` — wrong prefix, and does client-side broadcast + optimistic local mutation instead of trusting the server response / realtime push.
  - `broadcastEvent`/`sendMessage` (~line 384) sends raw JSON over the socket expecting peers to self-apply — this model doesn't match how `RealtimeBroadcastService` actually distributes events (server pushes `RealtimeEventType` payloads after each REST mutation succeeds).
  - `submitOrder` (~line 514) posts to `/group-orders/${id}/submit`, which doesn't exist anywhere in the backend — **out of scope for this phase**, belongs to Phase C (the route that will actually exist is documented there; this phase leaves `submitOrder` unimplemented with a clear `TODO`-free stub that throws, not a silent no-op — see Task 1, Step 3).
- `apps/customer-app/src/components/group/GroupCartPanel.vue` (314 lines) — pure presentational component, props already documented above. **Not modified in this phase.**
- No router entry exists anywhere for group ordering (`grep -n "group" apps/customer-app/src/router/index.ts` returns nothing).
- Backend response shapes actually returned (for mapping reference):
  - `GroupOrderMember` (`apps/api/src/features/group-orders/types/index.ts`): `{ id, memberId, groupOrderId, memberName, phone?, email?, isHost, joinedAt, leftAt?, totalAmount, paidAmount, paymentStatus }`.
  - `GroupOrderCartItem`: `{ id, itemId, groupOrderId, memberId, menuItemId: number, quantity, unitPrice, totalPrice, customizations, specialInstructions? }` plus (per `GroupOrdersService.getGroupOrder`) a nested `menuItem: { id, name, price, imageUrl? }` on cart items returned from `GET /orders/group/:id`.
  - `GroupOrderSummary` (the body of `GET /orders/group/:id`): `{ groupOrder: GroupOrder, members: GroupOrderMember[], cartItems: (GroupOrderCartItem & { menuItem })[], activities }`.
  - `GroupOrderJoinPreview` (Phase A, `GET /orders/group/join/:shareCode`): `{ groupOrderId, restaurantId, hostName, memberCount, fulfillmentType, expiresAt, status }`.
  - Realtime events land as `RealtimeEventType.GROUP_MEMBER_JOINED | GROUP_CART_ITEM_ADDED | GROUP_CART_ITEM_UPDATED | GROUP_CART_ITEM_REMOVED` with `data: { groupOrderId, ...eventSpecificFields }` (see `broadcastGroupOrderEvent` call sites in `routes/index.ts`).

---

### Task 1: Rewrite `useGroupOrder.ts`'s data layer against the real API

**Files:**
- Modify: `apps/customer-app/src/composables/useGroupOrder.ts`
- Test: `apps/customer-app/src/composables/useGroupOrder.test.ts` (new — check first whether this file already exists; if so, extend it instead of overwriting)

**Interfaces:**
- Produces (unchanged from today, so `GroupCartPanel.vue` needs no changes): `GroupMember`, `GroupCartItem`, `SplitBillConfig`, `GroupOrder` types; `useGroupOrder()` returning at least `{ groupOrder, members, cartItems, isHost, createGroup, joinGroup, fetchGroupOrder, addToCart, updateCartItem, removeCartItem, connectRealtime, disconnectRealtime }`.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/customer-app/src/composables/useGroupOrder.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { apiClient } from "@/services/api";

vi.mock("@/services/api", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("./useWebSocket", () => ({
  useWebSocket: () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendMessage: vi.fn(),
    onMessage: vi.fn(),
    isConnected: { value: false },
  }),
}));

import { useGroupOrder } from "./useGroupOrder";

describe("useGroupOrder — addToCart", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts to /orders/group/:id/cart, not /group-orders/:id/cart", async () => {
    const { createGroup, addToCart } = useGroupOrder();
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          groupOrderId: "go-1",
          shareCode: "ABC12345",
          expiresAt: new Date().toISOString(),
          host: { id: "m-1", memberId: "m-1", memberName: "Alex", isHost: true },
          memberToken: "session-1",
          recoveryCode: "recovery-1",
        },
      },
    });
    await createGroup({ restaurantId: "rest-1", hostName: "Alex" } as never);

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: "item-1",
          itemId: "item-1",
          groupOrderId: "go-1",
          memberId: "m-1",
          menuItemId: 42,
          quantity: 1,
          unitPrice: 10,
          totalPrice: 10,
          customizations: {},
        },
      },
    });

    await addToCart({ menuItemId: "42", menuItemName: "Fried Rice", menuItemPrice: 10, quantity: 1 });

    expect(apiClient.post).toHaveBeenCalledWith(
      "/orders/group/go-1/cart",
      expect.objectContaining({ menuItemId: 42, quantity: 1 }),
    );
  });

  it("does not broadcast the cart mutation over the socket itself", async () => {
    const { createGroup, addToCart } = useGroupOrder();
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { success: true, data: { groupOrderId: "go-1", shareCode: "X", expiresAt: new Date().toISOString(), host: { id: "m-1", memberId: "m-1", memberName: "Alex", isHost: true }, memberToken: "s-1", recoveryCode: "r-1" } },
    });
    await createGroup({ restaurantId: "rest-1" } as never);

    vi.mocked(apiClient.post).mockResolvedValue({
      data: { success: true, data: { id: "i-1", itemId: "i-1", groupOrderId: "go-1", memberId: "m-1", menuItemId: 1, quantity: 1, unitPrice: 1, totalPrice: 1, customizations: {} } },
    });
    await addToCart({ menuItemId: "1", menuItemName: "X", menuItemPrice: 1, quantity: 1 });

    // The server's own broadcast (via RealtimeBroadcastService) is the only
    // fan-out — the client must not also push a "cart_item_added" message.
    const socketSends = vi.mocked(apiClient.post).mock.calls.filter(
      ([url]) => typeof url === "string" && url.includes("/cart"),
    );
    expect(socketSends).toHaveLength(1);
  });
});

describe("useGroupOrder — submitOrder is explicitly not implemented in this phase", () => {
  it("throws a clear NotImplementedError rather than calling a non-existent endpoint", async () => {
    const { submitOrder } = useGroupOrder();
    await expect(submitOrder()).rejects.toThrow(/not yet available/i);
    expect(apiClient.post).not.toHaveBeenCalledWith(
      expect.stringContaining("/submit"),
      expect.anything(),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter customer-app exec vitest run src/composables/useGroupOrder.test.ts`
Expected: FAIL — current `addToCart` posts to `/group-orders/go-1/cart` (wrong prefix) and also calls `broadcastEvent`/`sendMessage`; `submitOrder` posts to a nonexistent `/group-orders/:id/submit` instead of throwing.

- [ ] **Step 3: Rewrite the composable's data layer**

In `useGroupOrder.ts`, keep the exported type declarations (`GroupMember`, `GroupCartItem`, `SplitBillConfig`, `GroupOrder`, `GroupOrderEvent`) exactly as they are. Replace the implementation of `createGroup`, `joinGroup`, `fetchGroupOrder` (or whatever the existing detail-fetch function is named), `addToCart`, `updateCartItem`, `removeCartItem`, and `submitOrder` with mapping functions against the real shapes:

```typescript
function toGroupMember(m: {
  id: string;
  memberName: string;
  isHost: boolean;
  joinedAt: string | Date;
  phone?: string;
}): GroupMember {
  const joinedAt =
    m.joinedAt instanceof Date ? m.joinedAt.getTime() : new Date(m.joinedAt).getTime();
  return {
    id: m.id,
    name: m.memberName,
    phone: m.phone,
    isHost: m.isHost,
    isOnline: true, // presence isn't tracked yet — see "Still open"
    joinedAt,
    lastActivity: joinedAt,
  };
}

function toGroupCartItem(item: {
  id: string;
  memberId: string;
  menuItemId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations?: Record<string, unknown>;
  specialInstructions?: string;
  menuItem?: { name: string; price: number };
}, memberName: string): GroupCartItem {
  return {
    id: item.id,
    menuItemId: String(item.menuItemId),
    menuItemName: item.menuItem?.name ?? "",
    menuItemPrice: item.menuItem?.price ?? item.unitPrice,
    quantity: item.quantity,
    options: item.customizations,
    notes: item.specialInstructions,
    addedBy: item.memberId,
    addedByName: memberName,
    addedAt: Date.now(),
  };
}

async function createGroup(data: {
  restaurantId: string;
  hostName?: string;
  tableId?: number;
  fulfillmentType?: "dine_in" | "delivery" | "pickup";
}) {
  const response = await apiClient.post("/orders/group/create", data);
  const { groupOrderId, shareCode, expiresAt, host, memberToken } = response.data.data;
  userId = host.id;
  userName = host.memberName ?? data.hostName ?? "Host";
  sessionToken = memberToken;
  groupOrder.value = {
    id: groupOrderId,
    restaurantId: data.restaurantId,
    tableId: data.tableId ? String(data.tableId) : "",
    hostId: host.id,
    hostName: userName,
    status: "open",
    members: [toGroupMember({ ...host, memberName: userName, isHost: true, joinedAt: new Date() })],
    cartItems: [],
    splitBillConfig: { mode: "equal" },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: new Date(expiresAt).getTime(),
  };
  return { shareCode, expiresAt };
}

async function joinGroup(shareCode: string, memberName: string) {
  const response = await apiClient.post(`/orders/group/join/${shareCode}`, { memberName });
  const { member, groupOrder: order, memberToken } = response.data.data;
  userId = member.id;
  userName = memberName;
  sessionToken = memberToken;
  await fetchGroupOrder(order.groupOrderId ?? order.id);
}

async function fetchGroupOrder(groupOrderId: string) {
  const response = await apiClient.get(`/orders/group/${groupOrderId}`);
  const summary = response.data.data as {
    groupOrder: { id: string; restaurantId: string; tableId?: number; createdBy?: string; status: string; expiresAt: string };
    members: Array<{ id: string; memberName: string; isHost: boolean; joinedAt: string; phone?: string }>;
    cartItems: Array<Parameters<typeof toGroupCartItem>[0]>;
  };

  const memberNameById = new Map(summary.members.map((m) => [m.id, m.memberName]));
  const host = summary.members.find((m) => m.isHost);

  groupOrder.value = {
    id: summary.groupOrder.id,
    restaurantId: summary.groupOrder.restaurantId,
    tableId: summary.groupOrder.tableId ? String(summary.groupOrder.tableId) : "",
    hostId: host?.id ?? "",
    hostName: host?.memberName ?? "Host",
    status: mapBackendStatus(summary.groupOrder.status),
    members: summary.members.map(toGroupMember),
    cartItems: summary.cartItems.map((item) =>
      toGroupCartItem(item, memberNameById.get(item.memberId) ?? ""),
    ),
    splitBillConfig: { mode: "equal" },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    expiresAt: new Date(summary.groupOrder.expiresAt).getTime(),
  };
}

function mapBackendStatus(status: string): GroupOrder["status"] {
  // Backend vocabulary is active/checkout/completed/cancelled (see Phase C
  // for the GroupOrderStatus type fix). "open"/"ordering"/"submitted" here
  // are this composable's own display vocabulary, kept stable for
  // GroupCartPanel.vue.
  switch (status) {
    case "active":
      return "open";
    case "checkout":
      return "submitted";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "open";
  }
}

async function addToCart(
  item: Omit<GroupCartItem, "id" | "addedBy" | "addedByName" | "addedAt">,
) {
  if (!groupOrder.value) return;
  const response = await apiClient.post(`/orders/group/${groupOrder.value.id}/cart`, {
    memberId: userId,
    menuItemId: Number(item.menuItemId),
    quantity: item.quantity,
    customizations: item.options,
    specialInstructions: item.notes,
  });
  const created = response.data.data;
  handleCartItemAdded(toGroupCartItem(created, userName));
}

async function updateCartItem(itemId: string, updates: { quantity?: number; options?: Record<string, unknown>; notes?: string }) {
  if (!groupOrder.value) return;
  const response = await apiClient.put(
    `/orders/group/${groupOrder.value.id}/cart/${itemId}`,
    {
      quantity: updates.quantity,
      customizations: updates.options,
      specialInstructions: updates.notes,
    },
  );
  const updated = response.data.data;
  handleCartItemUpdated(toGroupCartItem(updated, userName));
}

async function removeCartItem(itemId: string) {
  if (!groupOrder.value) return;
  await apiClient.delete(`/orders/group/${groupOrder.value.id}/cart/${itemId}`, {
    data: { memberId: userId },
  });
  handleCartItemRemoved({ itemId });
}

async function submitOrder(): Promise<never> {
  throw new Error(
    "Group order finalize/submit is not yet available — see Phase C of the group ordering plan",
  );
}
```

(`handleCartItemAdded`/`handleCartItemUpdated`/`handleCartItemRemoved` are the existing local-state mutators already in the file — reuse them, don't duplicate their logic. Remove the old `broadcastEvent`/`sendMessage` calls from every cart mutation function; realtime consumption is wired in Task 2, not here.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter customer-app exec vitest run src/composables/useGroupOrder.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter customer-app typecheck`
Expected: PASS — in particular, confirm `GroupCartPanel.vue` still compiles against the unchanged `GroupCartItem`/`GroupMember`/`SplitBillConfig` types.

- [ ] **Step 6: Commit**

```bash
git add apps/customer-app/src/composables/useGroupOrder.ts apps/customer-app/src/composables/useGroupOrder.test.ts
git commit -m "fix(customer-app): point useGroupOrder at the real group-orders API"
```

---

### Task 2: Listen for server-pushed realtime cart events

**Files:**
- Modify: `apps/customer-app/src/composables/useGroupOrder.ts`
- Test: `apps/customer-app/src/composables/useGroupOrder.test.ts` (extend)

**Interfaces:**
- Consumes: `POST /realtime/auth/group-token` (already called correctly today), `useWebSocket` composable's `onMessage`/`connect` API (read `apps/customer-app/src/composables/useWebSocket.ts`'s actual exported shape before writing this task's implementation — do not assume a signature not confirmed there).
- Produces: `connectRealtime(): Promise<void>`, `disconnectRealtime(): void` — consumed by Task 3's view.

- [ ] **Step 1: Write the failing test**

```typescript
it("applies a server-pushed GROUP_CART_ITEM_ADDED event to local state without re-broadcasting it", async () => {
  const messageHandlers: Array<(raw: string) => void> = [];
  vi.doMock("./useWebSocket", () => ({
    useWebSocket: () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendMessage: vi.fn(),
      onMessage: (handler: (raw: string) => void) => messageHandlers.push(handler),
      isConnected: { value: true },
    }),
  }));
  const { useGroupOrder } = await import("./useGroupOrder");
  const { createGroup, connectRealtime, cartItems } = useGroupOrder();

  vi.mocked(apiClient.post).mockResolvedValueOnce({
    data: { success: true, data: { groupOrderId: "go-1", shareCode: "X", expiresAt: new Date().toISOString(), host: { id: "m-1", memberId: "m-1", memberName: "Alex", isHost: true }, memberToken: "s-1", recoveryCode: "r-1" } },
  });
  await createGroup({ restaurantId: "rest-1" } as never);
  vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true, data: { token: "rt-1" } } });
  await connectRealtime();

  messageHandlers[0](
    JSON.stringify({
      type: "group_cart_item_added",
      data: {
        groupOrderId: "go-1",
        item: { id: "i-2", memberId: "m-2", menuItemId: 7, quantity: 2, unitPrice: 3, totalPrice: 6, customizations: {} },
      },
    }),
  );

  expect(cartItems.value).toHaveLength(1);
  expect(cartItems.value[0].id).toBe("i-2");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter customer-app exec vitest run src/composables/useGroupOrder.test.ts -t "GROUP_CART_ITEM_ADDED"`
Expected: FAIL — `connectRealtime` doesn't exist yet; no message handler applies server events.

- [ ] **Step 3: Implement**

First read `apps/customer-app/src/composables/useWebSocket.ts` to confirm its exact exported function names/signatures (`connect`, `onMessage` or an event-emitter pattern, `isConnected`) — do not guess; adjust the snippet below to match what's actually there.

```typescript
async function connectRealtime() {
  if (!groupOrder.value) return;
  const response = await apiClient.post("/realtime/auth/group-token", {
    groupOrderId: groupOrder.value.id,
    memberToken: sessionToken,
  });
  const { token } = response.data.data;

  ws.connect(token);
  ws.onMessage((raw: string) => {
    let event: { type: string; data: Record<string, unknown> };
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    if (event.data?.groupOrderId !== groupOrder.value?.id) return;

    switch (event.type) {
      case "group_member_joined":
        handleMemberJoined(toGroupMember(event.data.member as never));
        break;
      case "group_cart_item_added":
        handleCartItemAdded(toGroupCartItem(event.data.item as never, ""));
        break;
      case "group_cart_item_updated":
        handleCartItemUpdated(toGroupCartItem(event.data.item as never, ""));
        break;
      case "group_cart_item_removed":
        handleCartItemRemoved({ itemId: event.data.itemId as string });
        break;
    }
  });
}

function disconnectRealtime() {
  ws.disconnect();
}
```

(Match `RealtimeEventType`'s actual string values from `@makanmakan/shared-types` rather than the guessed lowercase-snake-case literals above — read that enum before finalizing this switch statement's case labels.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter customer-app exec vitest run src/composables/useGroupOrder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/customer-app/src/composables/useGroupOrder.ts apps/customer-app/src/composables/useGroupOrder.test.ts
git commit -m "feat(customer-app): consume server-pushed group-order realtime events"
```

---

### Task 3: Join-preview view + router wiring

**Files:**
- Create: `apps/customer-app/src/views/GroupOrderJoinView.vue`
- Create: `apps/customer-app/src/views/GroupOrderView.vue`
- Modify: `apps/customer-app/src/router/index.ts`
- Test: `apps/customer-app/src/views/GroupOrderJoinView.test.ts` (new)

**Interfaces:**
- Consumes: `GET /orders/group/join/:shareCode` (Phase A preview endpoint), `useGroupOrder()` (Tasks 1-2), `GroupCartPanel.vue` (unchanged).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/customer-app/src/views/GroupOrderJoinView.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { apiClient } from "@/services/api";

vi.mock("@/services/api", () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

import GroupOrderJoinView from "./GroupOrderJoinView.vue";

describe("GroupOrderJoinView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the join preview and requires an explicit confirm tap before joining", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          groupOrderId: "go-1",
          restaurantId: "r-1",
          hostName: "Alex",
          memberCount: 2,
          fulfillmentType: "dine_in",
          expiresAt: new Date(Date.now() + 40 * 60 * 1000).toISOString(),
          status: "active",
        },
      },
    });

    const wrapper = mount(GroupOrderJoinView, {
      props: { shareCode: "ABC12345" },
      global: { stubs: { RouterLink: true } },
    });
    await flushPromises(wrapper);

    expect(wrapper.text()).toContain("Alex");
    expect(wrapper.text()).toContain("2");
    // Joining must not happen just from loading the preview.
    expect(apiClient.post).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="join-confirm-button"]').trigger("click");
    expect(wrapper.find('[data-testid="join-name-input"]').exists()).toBe(true);
  });
});

async function flushPromises(wrapper: { vm: unknown }) {
  await Promise.resolve();
  await Promise.resolve();
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter customer-app exec vitest run src/views/GroupOrderJoinView.test.ts`
Expected: FAIL — the view doesn't exist yet.

- [ ] **Step 3: Implement `GroupOrderJoinView.vue`**

```vue
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { apiClient } from "@/services/api";
import { useGroupOrder } from "@/composables/useGroupOrder";

const props = defineProps<{ shareCode: string }>();
const router = useRouter();
const { joinGroup } = useGroupOrder();

const preview = ref<{
  hostName: string;
  memberCount: number;
  fulfillmentType: string;
  expiresAt: string;
} | null>(null);
const notFound = ref(false);
const showNameInput = ref(false);
const name = ref("");
const joining = ref(false);

onMounted(async () => {
  try {
    const response = await apiClient.get(`/orders/group/join/${props.shareCode}`);
    preview.value = response.data.data;
  } catch {
    notFound.value = true;
  }
});

function confirmJoinIntent() {
  showNameInput.value = true;
}

async function confirmJoin() {
  joining.value = true;
  try {
    await joinGroup(props.shareCode, name.value);
    router.push({ name: "GroupOrder", params: { groupOrderId: preview.value ? undefined : undefined } });
  } finally {
    joining.value = false;
  }
}
</script>

<template>
  <div v-if="notFound" data-testid="join-not-found">This group order was not found or has expired.</div>
  <div v-else-if="preview">
    <p>{{ preview.hostName }}'s group order — {{ preview.memberCount }} joined</p>
    <button v-if="!showNameInput" data-testid="join-confirm-button" @click="confirmJoinIntent">
      加入點餐
    </button>
    <div v-else>
      <input v-model="name" data-testid="join-name-input" placeholder="Your name" />
      <button data-testid="join-submit-button" :disabled="joining" @click="confirmJoin">Join</button>
    </div>
  </div>
</template>
```

(This is a functional skeleton, not a final design pass — apply the Apple-Native Soft Minimalism design system per `docs/UIUX-design-system.md` before this ships, as a follow-up styling pass. This task's scope is behavior: preview loads without joining, join requires an explicit tap plus a name, matching design spec decision 4.)

- [ ] **Step 4: Implement `GroupOrderView.vue`**

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useGroupOrder } from "@/composables/useGroupOrder";
import GroupCartPanel from "@/components/group/GroupCartPanel.vue";

const props = defineProps<{ groupOrderId: string }>();
const {
  groupOrder,
  members,
  cartItems,
  isHost,
  fetchGroupOrder,
  connectRealtime,
  disconnectRealtime,
  updateCartItem,
  removeCartItem,
} = useGroupOrder();

onMounted(async () => {
  await fetchGroupOrder(props.groupOrderId);
  await connectRealtime();
});
onUnmounted(() => disconnectRealtime());
</script>

<template>
  <GroupCartPanel
    v-if="groupOrder"
    :cart-items="cartItems"
    :members="members"
    :current-user-id="groupOrder.hostId"
    :split-bill-config="groupOrder.splitBillConfig"
    :total-amount="0"
    :my-share="0"
    :is-host="isHost"
    @update-quantity="(itemId, quantity) => updateCartItem(itemId, { quantity })"
    @remove-item="removeCartItem"
  />
</template>
```

- [ ] **Step 5: Add router entries**

In `apps/customer-app/src/router/index.ts`, add:

```typescript
  {
    path: "/group/:shareCode",
    name: "GroupOrderJoin",
    component: () => import("@/views/GroupOrderJoinView.vue"),
    props: true,
  },
  {
    path: "/group/order/:groupOrderId",
    name: "GroupOrder",
    component: () => import("@/views/GroupOrderView.vue"),
    props: true,
  },
```

(`/group/:shareCode` matches the `shareUrl: \`/group/${shareCode}\`` format the backend's `/orders/group/generate-code` route already returns — Phase A's `createGroupOrder` response should be checked for the same convention when wiring the "share this link" UI, so the link the host shares and this route agree on the same path shape.) Fix `GroupOrderJoinView`'s `confirmJoin` to `router.push({ name: "GroupOrder", params: { groupOrderId: <the real id from joinGroup's result> } })` — the skeleton in Step 3 has a placeholder `undefined` that must be replaced with the actual joined group order's id (returned from `fetchGroupOrder`'s internal state, i.e. read it off `groupOrder.value.id` after `joinGroup` resolves).

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter customer-app exec vitest run src/views/GroupOrderJoinView.test.ts`
Expected: PASS

- [ ] **Step 7: Typecheck and manual smoke test**

Run: `pnpm --filter customer-app typecheck`
Then: `pnpm dev:customer`, navigate to `/group/<a real shareCode created via the API>`, confirm the preview renders and joining transitions to the cart view.

- [ ] **Step 8: Commit**

```bash
git add apps/customer-app/src/views/GroupOrderJoinView.vue \
  apps/customer-app/src/views/GroupOrderView.vue \
  apps/customer-app/src/views/GroupOrderJoinView.test.ts \
  apps/customer-app/src/router/index.ts
git commit -m "feat(customer-app): add reachable group-order join and cart views"
```

---

## Self-review notes

- **Spec coverage:** design decision 2 (join preview before entering the cart, Task 3), the realtime sync half of the "collaborative cart" section (Tasks 1-2). Decision 4's "same shareCode for URL and manual entry" is already satisfied by Phase A's backend; this phase only needed to make the URL path actually load something.
- **Placeholder scan:** Task 3's `GroupOrderJoinView.vue` skeleton is explicitly flagged as functional-not-final and the `router.push` placeholder is called out with an explicit fix-it instruction in Step 5, not left as a silent gap.
- **Type consistency:** `GroupCartItem`/`GroupMember`/`SplitBillConfig`/`GroupOrder` are defined once (pre-existing, unchanged) and every mapping function in Tasks 1-2 targets those exact shapes; `GroupOrderView.vue`'s props to `GroupCartPanel` match that component's existing `Props` interface read directly from its source.
- **Known gap carried forward, not silently dropped:** `submitOrder()` is a hard-fail stub in this phase (Task 1, Step 3) — Phase C must replace it with a real call to the new finalize endpoint; this is the explicit handoff point between the two plans.
