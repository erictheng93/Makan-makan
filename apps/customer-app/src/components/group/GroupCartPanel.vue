<script setup lang="ts">
/**
 * Group Cart Panel
 * 群組購物車面板 - 顯示所有成員的購物車項目
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type {
  GroupCartItem,
  GroupMember,
  SplitBillConfig,
} from "@/composables/useGroupOrder";
import { useCurrency } from "@/composables/useCurrency";

// Props
interface Props {
  cartItems: GroupCartItem[];
  members: GroupMember[];
  currentUserId: string;
  splitBillConfig: SplitBillConfig;
  totalAmount: number;
  myShare: number;
  isHost: boolean;
}

const props = defineProps<Props>();

// Emit events
const emit = defineEmits<{
  (e: "update-quantity", itemId: string, quantity: number): void;
  (e: "remove-item", itemId: string): void;
  (e: "change-split-mode", mode: SplitBillConfig["mode"]): void;
}>();

// i18n
const { t } = useI18n();

// Computed
const itemsByMember = computed(() => {
  const grouped: Record<string, GroupCartItem[]> = {};

  props.cartItems.forEach((item) => {
    if (!grouped[item.addedBy]) {
      grouped[item.addedBy] = [];
    }
    grouped[item.addedBy].push(item);
  });

  return grouped;
});

const memberById = computed(() => {
  const map: Record<string, GroupMember> = {};
  props.members.forEach((m) => {
    map[m.id] = m;
  });
  return map;
});

const { formatAmount: formatPrice } = useCurrency();

// Methods
function canModifyItem(item: GroupCartItem): boolean {
  return item.addedBy === props.currentUserId || props.isHost;
}

function getMemberName(memberId: string): string {
  const member = memberById.value[memberId];
  if (!member) return t("group.unknownMember");
  if (memberId === props.currentUserId) return t("group.me");
  return member.name;
}

function getMemberColor(memberId: string): string {
  // Generate consistent color based on member ID
  // Low-saturation pastel palette (design-system 4.3 pastel accents)
  const colors = [
    "bg-ios-blue/15 text-ios-blue",
    "bg-ios-green/15 text-ios-green",
    "bg-ios-orange/15 text-ios-orange",
    "bg-ios-red/15 text-ios-red",
    "bg-ios-teal/15 text-ios-teal",
    "bg-ios-blue/15 text-ios-blue",
  ];
  const index = Math.abs(memberId.charCodeAt(0)) % colors.length;
  return colors[index];
}
</script>

<template>
  <div
    class="group-cart-panel bg-ios-card rounded-2xl shadow-[0_2px_8px_rgb(0,0,0,0.04)] overflow-hidden"
  >
    <!-- Header -->
    <div class="px-4 py-3 bg-ios-blue text-white">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <span class="font-semibold">{{ t("group.sharedCart") }}</span>
        </div>
        <span class="text-sm opacity-90">
          {{ members.length }} {{ t("group.members") }}
        </span>
      </div>
    </div>

    <!-- Cart Items by Member -->
    <div class="divide-y divide-gray-100">
      <template v-for="(items, memberId) in itemsByMember" :key="memberId">
        <div class="p-4">
          <!-- Member Header -->
          <div class="flex items-center space-x-2 mb-3">
            <span
              class="px-2 py-0.5 text-xs font-medium rounded-full"
              :class="getMemberColor(memberId)"
            >
              {{ getMemberName(memberId) }}
            </span>
            <span
              v-if="memberById[memberId]?.isOnline"
              class="w-2 h-2 bg-green-500 rounded-full"
              :title="t('group.online')"
            />
          </div>

          <!-- Member's Items -->
          <div class="space-y-3">
            <div
              v-for="item in items"
              :key="item.id"
              class="flex items-center justify-between"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 truncate">
                  {{ item.menuItemName }}
                </div>
                <div class="text-xs text-gray-500">
                  {{ formatPrice(item.menuItemPrice) }} x {{ item.quantity }}
                </div>
                <div
                  v-if="item.notes"
                  class="text-xs text-gray-400 italic mt-0.5"
                >
                  {{ item.notes }}
                </div>
              </div>

              <div class="flex items-center space-x-3 ml-4">
                <!-- Price -->
                <span class="text-sm font-semibold text-gray-900">
                  {{ formatPrice(item.menuItemPrice * item.quantity) }}
                </span>

                <!-- Actions (only for own items or host) -->
                <div
                  v-if="canModifyItem(item)"
                  class="flex items-center space-x-1"
                >
                  <!-- Quantity Controls -->
                  <button
                    class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    :disabled="item.quantity <= 1"
                    @click="emit('update-quantity', item.id, item.quantity - 1)"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M20 12H4"
                      />
                    </svg>
                  </button>
                  <span class="w-6 text-center text-sm">{{
                    item.quantity
                  }}</span>
                  <button
                    class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    @click="emit('update-quantity', item.id, item.quantity + 1)"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>

                  <!-- Remove -->
                  <button
                    class="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded ml-1"
                    @click="emit('remove-item', item.id)"
                  >
                    <svg
                      class="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Empty State -->
      <div v-if="cartItems.length === 0" class="p-8 text-center text-gray-500">
        <svg
          class="w-12 h-12 mx-auto mb-3 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p>{{ t("group.emptyCart") }}</p>
        <p class="text-sm mt-1">
          {{ t("group.startAdding") }}
        </p>
      </div>
    </div>

    <!-- Split Bill Summary -->
    <div class="px-4 py-4 bg-gray-50 border-t border-gray-100">
      <!-- Split Mode Selector (Host Only) -->
      <div v-if="isHost" class="mb-4">
        <label class="block text-xs font-medium text-gray-500 mb-2">
          {{ t("group.splitMethod") }}
        </label>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="mode in [
              'equal',
              'by_item',
              'custom',
              'single_payer',
            ] as const"
            :key="mode"
            class="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
            :class="
              splitBillConfig.mode === mode
                ? 'bg-ios-blue text-white'
                : 'bg-ios-bg text-ios-secondary hover:bg-ios-separator'
            "
            @click="emit('change-split-mode', mode)"
          >
            {{ t(`group.split.${mode}`) }}
          </button>
        </div>
      </div>

      <!-- Totals -->
      <div class="space-y-2">
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">{{ t("group.total") }}</span>
          <span class="font-semibold text-gray-900">{{
            formatPrice(totalAmount)
          }}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">{{ t("group.myShare") }}</span>
          <span class="font-bold text-ios-blue">{{
            formatPrice(myShare)
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.group-cart-panel {
  max-height: 70vh;
  overflow-y: auto;
}
</style>
