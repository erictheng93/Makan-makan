<template>
  <div
    class="bg-white rounded-lg shadow-sm p-6 border-l-4"
    :class="borderColor"
  >
    <div class="flex items-center">
      <div class="flex-shrink-0">
        <div class="p-3 rounded-lg" :class="iconBgColor">
          <component :is="iconComponent" class="h-8 w-8" :class="iconColor" />
        </div>
      </div>
      <div class="ml-4 flex-1">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600">
              {{ title }}
            </p>
            <p class="text-2xl font-bold text-gray-900">
              {{ value }}
            </p>
          </div>
          <div v-if="trend" class="flex items-center">
            <ArrowTrendingUpIcon
              v-if="trend === 'up'"
              class="h-4 w-4 text-green-500 mr-1"
            />
            <ArrowTrendingDownIcon
              v-if="trend === 'down'"
              class="h-4 w-4 text-red-500 mr-1"
            />
            <MinusIcon
              v-if="trend === 'stable'"
              class="h-4 w-4 text-gray-500 mr-1"
            />
          </div>
        </div>
        <p v-if="subtitle" class="text-sm text-gray-500 mt-1">
          {{ subtitle }}
        </p>
      </div>
    </div>

    <!-- 進度條（可選） -->
    <div v-if="progress !== undefined" class="mt-4">
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="h-2 rounded-full transition-all duration-300 ease-in-out"
          :class="progressColor"
          :style="{ width: `${Math.min(progress, 100)}%` }"
        />
      </div>
      <div class="flex justify-between text-xs text-gray-500 mt-1">
        <span>0</span>
        <span>{{ progress }}%</span>
        <span>100</span>
      </div>
    </div>

    <!-- 額外信息（可選） -->
    <div v-if="$slots.extra" class="mt-4 pt-4 border-t border-gray-200">
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  QueueListIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  TableCellsIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
} from "@heroicons/vue/24/outline";
import type { Component } from "vue";

interface Props {
  title: string;
  value: string | number;
  icon: string;
  color: "green" | "blue" | "yellow" | "red" | "purple" | "gray";
  subtitle?: string;
  trend?: "up" | "down" | "stable";
  progress?: number;
}

const props = withDefaults(defineProps<Props>(), {
  color: "blue",
  subtitle: undefined,
  trend: undefined,
  progress: undefined,
});

// 圖標組件映射
const iconComponents: Record<string, Component> = {
  QueueListIcon,
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  ShoppingBagIcon,
  TableCellsIcon,
  ExclamationTriangleIcon,
};

const iconComponent = computed(() => {
  return iconComponents[props.icon] || ChartBarIcon;
});

// 顏色樣式計算
const colorClasses = {
  green: {
    border: "border-l-green-500",
    iconBg: "bg-green-100",
    icon: "text-green-600",
    progress: "bg-green-500",
  },
  blue: {
    border: "border-l-blue-500",
    iconBg: "bg-blue-100",
    icon: "text-blue-600",
    progress: "bg-blue-500",
  },
  yellow: {
    border: "border-l-yellow-500",
    iconBg: "bg-yellow-100",
    icon: "text-yellow-600",
    progress: "bg-yellow-500",
  },
  red: {
    border: "border-l-red-500",
    iconBg: "bg-red-100",
    icon: "text-red-600",
    progress: "bg-red-500",
  },
  purple: {
    border: "border-l-purple-500",
    iconBg: "bg-purple-100",
    icon: "text-purple-600",
    progress: "bg-purple-500",
  },
  gray: {
    border: "border-l-gray-500",
    iconBg: "bg-gray-100",
    icon: "text-gray-600",
    progress: "bg-gray-500",
  },
};

const borderColor = computed(() => colorClasses[props.color].border);
const iconBgColor = computed(() => colorClasses[props.color].iconBg);
const iconColor = computed(() => colorClasses[props.color].icon);
const progressColor = computed(() => colorClasses[props.color].progress);
</script>

<style scoped>
/* 卡片懸停效果 */
.bg-white {
  @apply transition-all duration-200 ease-in-out;
}

.bg-white:hover {
  @apply shadow-md transform scale-[1.02];
}

/* 響應式調整 */
@media (max-width: 768px) {
  .text-2xl {
    @apply text-xl;
  }

  .p-6 {
    @apply p-4;
  }

  .h-8.w-8 {
    @apply h-6 w-6;
  }

  .p-3 {
    @apply p-2;
  }
}
</style>
