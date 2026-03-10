<script setup lang="ts">
/**
 * Split Bill Selector
 * 分帳模式選擇器 - 支持均分、各付各、自訂、單人付款
 */
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { SplitBillConfig, GroupMember } from "@/composables/useGroupOrder";

// Props
interface Props {
  modelValue: SplitBillConfig;
  members: GroupMember[];
  totalAmount: number;
  currentUserId: string;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

// Emit
const emit = defineEmits<{
  (e: "update:modelValue", value: SplitBillConfig): void;
}>();

// i18n
const { t } = useI18n();

// Local state for custom shares
const customShares = ref<Record<string, number>>({});
const selectedPayer = ref<string>(props.currentUserId);

// Initialize custom shares when members change
watch(
  () => props.members,
  (newMembers) => {
    if (
      props.modelValue.mode === "custom" &&
      Object.keys(customShares.value).length === 0
    ) {
      const equalShare = 100 / newMembers.length;
      newMembers.forEach((m) => {
        customShares.value[m.id] = equalShare;
      });
    }
  },
  { immediate: true },
);

// Computed
const modes = computed(() => [
  {
    id: "equal" as const,
    icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
    label: t("group.split.equal", "均分"),
    description: t("group.split.equalDesc", "每人付一樣的金額"),
  },
  {
    id: "by_item" as const,
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    label: t("group.split.byItem", "各付各"),
    description: t("group.split.byItemDesc", "各自付自己點的餐點"),
  },
  {
    id: "custom" as const,
    icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    label: t("group.split.custom", "自訂"),
    description: t("group.split.customDesc", "自訂每人的比例"),
  },
  {
    id: "single_payer" as const,
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    label: t("group.split.singlePayer", "單人付"),
    description: t("group.split.singlePayerDesc", "由一人支付全部"),
  },
]);

const perPersonAmount = computed(() => {
  const count = props.members.length;
  return count > 0 ? props.totalAmount / count : 0;
});

const totalSharePercentage = computed(() => {
  return Object.values(customShares.value).reduce(
    (sum, share) => sum + share,
    0,
  );
});

const isValidCustomShares = computed(() => {
  return Math.abs(totalSharePercentage.value - 100) < 0.01;
});

// Methods
function selectMode(mode: SplitBillConfig["mode"]): void {
  if (props.disabled) return;

  const config: SplitBillConfig = { mode };

  if (mode === "custom") {
    // Initialize equal shares if not set
    if (Object.keys(customShares.value).length === 0) {
      const equalShare = 100 / props.members.length;
      props.members.forEach((m) => {
        customShares.value[m.id] = equalShare;
      });
    }
    config.customShares = { ...customShares.value };
  }

  if (mode === "single_payer") {
    config.singlePayerId = selectedPayer.value;
  }

  emit("update:modelValue", config);
}

function updateCustomShare(memberId: string, percentage: number): void {
  if (props.disabled) return;

  customShares.value[memberId] = Math.max(0, Math.min(100, percentage));

  emit("update:modelValue", {
    mode: "custom",
    customShares: { ...customShares.value },
  });
}

function selectPayer(memberId: string): void {
  if (props.disabled) return;

  selectedPayer.value = memberId;
  emit("update:modelValue", {
    mode: "single_payer",
    singlePayerId: memberId,
  });
}

function formatPrice(price: number): string {
  return `$${price.toFixed(0)}`;
}

function getMemberShareAmount(memberId: string): number {
  const share = customShares.value[memberId] || 0;
  return (props.totalAmount * share) / 100;
}
</script>

<template>
  <div class="split-bill-selector">
    <!-- Mode Selection -->
    <div class="grid grid-cols-2 gap-3 mb-6">
      <button
        v-for="mode in modes"
        :key="mode.id"
        class="p-4 rounded-xl border-2 transition-all text-left"
        :class="[
          modelValue.mode === mode.id
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-200 bg-white hover:border-gray-300',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ]"
        :disabled="disabled"
        @click="selectMode(mode.id)"
      >
        <div class="flex items-center space-x-3">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center"
            :class="
              modelValue.mode === mode.id
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-100 text-gray-500'
            "
          >
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
                :d="mode.icon"
              />
            </svg>
          </div>
          <div>
            <div class="font-semibold text-gray-900">{{ mode.label }}</div>
            <div class="text-xs text-gray-500">{{ mode.description }}</div>
          </div>
        </div>
      </button>
    </div>

    <!-- Equal Split Preview -->
    <div v-if="modelValue.mode === 'equal'" class="bg-gray-50 rounded-xl p-4">
      <div class="text-center mb-4">
        <div class="text-3xl font-bold text-indigo-600">
          {{ formatPrice(perPersonAmount) }}
        </div>
        <div class="text-sm text-gray-500">
          {{ t("group.perPerson", "每人") }}
        </div>
      </div>
      <div class="space-y-2">
        <div
          v-for="member in members"
          :key="member.id"
          class="flex items-center justify-between text-sm"
        >
          <span class="text-gray-600">
            {{
              member.id === currentUserId ? t("group.me", "我") : member.name
            }}
          </span>
          <span class="font-medium text-gray-900">{{
            formatPrice(perPersonAmount)
          }}</span>
        </div>
      </div>
    </div>

    <!-- Custom Shares Editor -->
    <div v-if="modelValue.mode === 'custom'" class="bg-gray-50 rounded-xl p-4">
      <div class="mb-3 flex items-center justify-between">
        <span class="text-sm font-medium text-gray-700">
          {{ t("group.customShares", "自訂比例") }}
        </span>
        <span
          class="text-xs px-2 py-0.5 rounded-full"
          :class="
            isValidCustomShares
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          "
        >
          {{ totalSharePercentage.toFixed(0) }}%
        </span>
      </div>

      <div class="space-y-4">
        <div v-for="member in members" :key="member.id" class="space-y-1">
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600">
              {{
                member.id === currentUserId ? t("group.me", "我") : member.name
              }}
            </span>
            <span class="font-medium text-gray-900">
              {{ formatPrice(getMemberShareAmount(member.id)) }}
            </span>
          </div>
          <div class="flex items-center space-x-3">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              :value="customShares[member.id] || 0"
              :disabled="disabled"
              class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              @input="
                updateCustomShare(
                  member.id,
                  Number(($event.target as HTMLInputElement).value),
                )
              "
            />
            <span class="w-12 text-right text-sm font-medium text-gray-700">
              {{ (customShares[member.id] || 0).toFixed(0) }}%
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="!isValidCustomShares"
        class="mt-3 text-xs text-red-600 flex items-center space-x-1"
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>{{
          t("group.sharesMustEqual100", "比例總和必須等於 100%")
        }}</span>
      </div>
    </div>

    <!-- Single Payer Selection -->
    <div
      v-if="modelValue.mode === 'single_payer'"
      class="bg-gray-50 rounded-xl p-4"
    >
      <div class="mb-3 text-sm font-medium text-gray-700">
        {{ t("group.selectPayer", "選擇付款人") }}
      </div>
      <div class="space-y-2">
        <button
          v-for="member in members"
          :key="member.id"
          class="w-full p-3 rounded-lg border-2 transition-all flex items-center justify-between"
          :class="[
            selectedPayer === member.id
              ? 'border-indigo-500 bg-white'
              : 'border-gray-200 bg-white hover:border-gray-300',
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          ]"
          :disabled="disabled"
          @click="selectPayer(member.id)"
        >
          <div class="flex items-center space-x-3">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center"
              :class="
                selectedPayer === member.id
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 text-gray-500'
              "
            >
              <svg
                v-if="selectedPayer === member.id"
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span v-else class="text-sm font-medium">{{
                member.name.charAt(0)
              }}</span>
            </div>
            <span class="font-medium text-gray-900">
              {{
                member.id === currentUserId ? t("group.me", "我") : member.name
              }}
            </span>
          </div>
          <span
            v-if="selectedPayer === member.id"
            class="text-lg font-bold text-indigo-600"
          >
            {{ formatPrice(totalAmount) }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.split-bill-selector input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #4f46e5;
  border-radius: 50%;
  cursor: pointer;
}

.split-bill-selector input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #4f46e5;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}
</style>
