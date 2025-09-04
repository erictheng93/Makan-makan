<template>
  <div class="card p-6 hover:shadow-lg transition-shadow">
    <div class="flex items-center justify-between">
      <div class="flex-1">
        <p class="text-sm font-medium text-gray-600 mb-1">
          {{ title }}
        </p>
        <div class="flex items-center">
          <p
            v-if="loading"
            class="text-2xl font-bold text-gray-400 animate-pulse"
          >
            --
          </p>
          <p v-else class="text-2xl font-bold" :class="textColorClass">
            {{ displayValue }}
          </p>
          <span v-if="trend && !loading" class="ml-2 flex items-center text-sm">
            <component
              :is="trendIcon"
              class="w-4 h-4 mr-1"
              :class="trendColorClass"
            />
            <span :class="trendColorClass">{{ trendText }}</span>
          </span>
        </div>
        <p v-if="subtitle && !loading" class="text-xs text-gray-500 mt-1">
          {{ subtitle }}
        </p>
      </div>
      <div class="ml-4">
        <div
          class="w-12 h-12 rounded-lg flex items-center justify-center"
          :class="iconBgClass"
        >
          <component
            :is="iconComponent"
            class="w-6 h-6"
            :class="iconColorClass"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Users,
  Clock,
  Package,
} from "lucide-vue-next";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: "blue" | "green" | "purple" | "orange" | "red" | "indigo";
  loading?: boolean;
  trend?: {
    value: number;
    period: string;
  };
  subtitle?: string;
}

const props = withDefaults(defineProps<StatsCardProps>(), {
  loading: false,
  trend: undefined,
  subtitle: undefined,
});

const iconMap = {
  "shopping-cart": ShoppingCart,
  "dollar-sign": DollarSign,
  "trending-up": TrendingUp,
  "check-circle": CheckCircle,
  users: Users,
  clock: Clock,
  package: Package,
};

const colorMap = {
  blue: {
    text: "text-blue-600",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
  },
  green: {
    text: "text-green-600",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
  },
  purple: {
    text: "text-purple-600",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
  },
  orange: {
    text: "text-orange-600",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
  },
  red: {
    text: "text-red-600",
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
  },
  indigo: {
    text: "text-indigo-600",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
  },
};

const iconComponent = computed(() => {
  return iconMap[props.icon as keyof typeof iconMap] || ShoppingCart;
});

const textColorClass = computed(() => colorMap[props.color].text);
const iconBgClass = computed(() => colorMap[props.color].iconBg);
const iconColorClass = computed(() => colorMap[props.color].iconColor);

const displayValue = computed(() => {
  if (typeof props.value === "number") {
    return props.value.toLocaleString();
  }
  return props.value;
});

const trendIcon = computed(() => {
  if (!props.trend) return null;
  return props.trend.value >= 0 ? TrendingUp : TrendingDown;
});

const trendColorClass = computed(() => {
  if (!props.trend) return "";
  return props.trend.value >= 0 ? "text-green-600" : "text-red-600";
});

const trendText = computed(() => {
  if (!props.trend) return "";
  const sign = props.trend.value >= 0 ? "+" : "";
  return `${sign}${props.trend.value.toFixed(1)}% ${props.trend.period}`;
});
</script>
