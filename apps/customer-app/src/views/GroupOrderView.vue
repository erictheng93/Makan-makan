<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import GroupCartPanel from "@/components/group/GroupCartPanel.vue";
import HostRecoveryPanel from "@/components/group/HostRecoveryPanel.vue";
import { useGroupOrder } from "@/composables/useGroupOrder";
import type { SplitBillConfig } from "@/composables/useGroupOrder";

const props = defineProps<{
  groupOrderId: string;
}>();

const group = useGroupOrder({ restaurantId: "" });
const viewError = ref("");
const splitNotice = ref("");
const hasSessionExpired = computed(() => group.sessionExpired?.value === true);

const isLocked = computed(() => {
  const status = group.groupOrder.value?.status;
  return status !== undefined && status !== "active";
});

const currentUserId = computed(() => group.currentMemberId?.value ?? "");

async function loadGroupOrder(): Promise<void> {
  try {
    await group.loadGroupOrder(props.groupOrderId);
    await group.connectToGroupOrder(props.groupOrderId);
  } catch (error) {
    viewError.value =
      error instanceof Error ? error.message : "Unable to load group order.";
  }
}

async function updateQuantity(itemId: string, quantity: number): Promise<void> {
  try {
    await group.updateCartItem(itemId, { quantity });
  } catch (error) {
    viewError.value =
      error instanceof Error ? error.message : "Unable to update item.";
  }
}

async function removeItem(itemId: string): Promise<void> {
  try {
    await group.removeFromCart(itemId);
  } catch (error) {
    viewError.value =
      error instanceof Error ? error.message : "Unable to remove item.";
  }
}

async function changeSplitMode(mode: SplitBillConfig["mode"]): Promise<void> {
  try {
    await group.setSplitBillMode(mode);
  } catch {
    splitNotice.value = "Split changes are not available yet.";
  }
}

onMounted(() => {
  void loadGroupOrder();
});

onUnmounted(() => {
  group.disconnectRealtime();
});
</script>

<template>
  <main class="min-h-screen bg-ios-bg px-4 py-6">
    <section class="mx-auto w-full max-w-2xl">
      <div class="mb-5">
        <p class="text-sm font-medium text-ios-secondary">Group order</p>
        <h1 class="text-2xl font-semibold text-ios-text">
          {{ group.groupOrder.value?.hostName || "Shared cart" }}
        </h1>
      </div>

      <p
        v-if="viewError"
        class="mb-4 rounded-md bg-ios-red/10 p-3 text-sm text-ios-red"
      >
        {{ viewError }}
      </p>

      <p
        v-if="hasSessionExpired"
        data-testid="group-order-session-expired"
        class="mb-4 rounded-md bg-ios-orange/10 p-3 text-sm text-ios-orange"
      >
        This host session has expired. Recover host access to continue.
      </p>

      <div
        v-if="isLocked"
        data-testid="group-order-locked"
        class="rounded-lg bg-ios-card p-5"
      >
        <h2 class="text-lg font-semibold text-ios-text">
          This group order is locked
        </h2>
        <p class="mt-2 text-sm text-ios-secondary">
          The group order is being finalized or has already moved to checkout.
        </p>
      </div>

      <GroupCartPanel
        v-else-if="group.groupOrder.value"
        :cart-items="group.groupOrder.value.cartItems"
        :members="group.groupOrder.value.members"
        :current-user-id="currentUserId"
        :split-bill-config="group.groupOrder.value.splitBillConfig"
        :total-amount="group.totalAmount.value"
        :my-share="group.myShare.value"
        :is-host="group.isHost.value"
        @update-quantity="updateQuantity"
        @remove-item="removeItem"
        @change-split-mode="changeSplitMode"
      />

      <div v-else class="py-16 text-center text-ios-secondary">
        Loading group order...
      </div>

      <p
        v-if="splitNotice"
        class="mt-4 rounded-md bg-ios-orange/10 p-3 text-sm text-ios-orange"
      >
        {{ splitNotice }}
      </p>

      <HostRecoveryPanel
        :group-order-id="props.groupOrderId"
        :recover="group.recoverHost"
      />
    </section>
  </main>
</template>
