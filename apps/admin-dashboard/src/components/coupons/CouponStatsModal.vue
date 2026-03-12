<template>
  <div
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
  >
    <div
      class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white"
    >
      <div class="mt-3">
        <!-- Modal Header -->
        <div class="flex items-center justify-between pb-4 border-b">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ t("couponStats.title") }} - {{ coupon?.name }}
          </h3>
          <button
            class="text-gray-400 hover:text-gray-600"
            @click="$emit('close')"
          >
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>

        <!-- Coupon Basic Info -->
        <div class="mt-6 bg-gray-50 rounded-lg p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 class="text-sm font-medium text-gray-700 mb-2">
                {{ t("couponStats.couponInfo") }}
              </h4>
              <div class="space-y-1">
                <p class="text-sm">
                  <span class="font-medium">{{ t("couponStats.code") }}:</span>
                  {{ coupon?.code }}
                </p>
                <p class="text-sm">
                  <span class="font-medium">{{ t("couponStats.name") }}:</span>
                  {{ coupon?.name }}
                </p>
                <p class="text-sm">
                  <span class="font-medium"
                    >{{ t("couponStats.discount") }}:</span
                  >
                  <span v-if="coupon?.discountType === 'percentage'">
                    {{ coupon?.discountValue }}%
                    <span
                      v-if="coupon?.maxDiscountAmount"
                      class="text-gray-500"
                    >
                      ({{ t("couponStats.maxDiscount") }} RM{{
                        formatMoney(coupon?.maxDiscountAmount)
                      }})
                    </span>
                  </span>
                  <span v-else>
                    RM{{ formatMoney(coupon?.discountValue) }}
                  </span>
                </p>
              </div>
            </div>
            <div>
              <h4 class="text-sm font-medium text-gray-700 mb-2">
                {{ t("couponStats.validityPeriod") }}
              </h4>
              <div class="space-y-1">
                <p class="text-sm">
                  <span class="font-medium">{{ t("couponStats.start") }}:</span>
                  {{ formatDateTime(coupon?.validFrom) }}
                </p>
                <p class="text-sm">
                  <span class="font-medium">{{ t("couponStats.end") }}:</span>
                  {{ formatDateTime(coupon?.validTo) }}
                </p>
                <p class="text-sm">
                  <span class="font-medium"
                    >{{ t("couponStats.statusLabel") }}:</span
                  >
                  <span :class="getStatusClass(coupon)">{{
                    getStatusText(coupon)
                  }}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Statistics -->
        <div v-if="stats" class="mt-6 space-y-6">
          <!-- Key Metrics -->
          <div>
            <h4 class="text-md font-medium text-gray-900 mb-4">
              {{ t("couponStats.keyMetrics") }}
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div class="bg-blue-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-blue-600">
                  {{ stats.totalUsed || 0 }}
                </div>
                <div class="text-sm text-blue-700">
                  {{ t("couponStats.totalUsed") }}
                </div>
                <div
                  v-if="coupon?.usageLimit"
                  class="text-xs text-blue-600 mt-1"
                >
                  {{ t("couponStats.remaining") }}:
                  {{ Math.max(0, coupon.usageLimit - (stats.totalUsed || 0)) }}
                </div>
              </div>

              <div class="bg-green-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-green-600">
                  RM{{ formatMoney(stats.totalDiscount || 0) }}
                </div>
                <div class="text-sm text-green-700">
                  {{ t("couponStats.totalDiscount") }}
                </div>
              </div>

              <div class="bg-purple-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-purple-600">
                  RM{{ formatMoney(stats.avgDiscount || 0) }}
                </div>
                <div class="text-sm text-purple-700">
                  {{ t("couponStats.avgDiscount") }}
                </div>
              </div>

              <div class="bg-orange-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-orange-600">
                  {{ usageRate }}%
                </div>
                <div class="text-sm text-orange-700">
                  {{ t("couponStats.usageRate") }}
                </div>
                <div
                  v-if="coupon?.usageLimit"
                  class="w-full bg-orange-200 rounded-full h-2 mt-2"
                >
                  <div
                    class="bg-orange-600 h-2 rounded-full"
                    :style="{ width: `${Math.min(100, usageRate)}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Usage Timeline -->
          <div v-if="stats.lastUsed">
            <h4 class="text-md font-medium text-gray-900 mb-4">
              {{ t("couponStats.usageTimeline") }}
            </h4>
            <div class="bg-gray-50 rounded-lg p-4">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-gray-700">
                    {{ t("couponStats.lastUsed") }}
                  </p>
                  <p class="text-sm text-gray-600">
                    {{ formatDateTime(stats.lastUsed) }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-medium text-gray-700">
                    {{ t("couponStats.createdAt") }}
                  </p>
                  <p class="text-sm text-gray-600">
                    {{ formatDateTime(coupon?.createdAt) }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Performance Insights -->
          <div>
            <h4 class="text-md font-medium text-gray-900 mb-4">
              {{ t("couponStats.performanceInsights") }}
            </h4>
            <div class="space-y-3">
              <!-- Success Rate -->
              <div class="bg-white border rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <h5 class="text-sm font-medium text-gray-800">
                      {{ t("couponStats.couponEffect") }}
                    </h5>
                    <p class="text-xs text-gray-600">
                      {{ t("couponStats.effectDescription") }}
                    </p>
                  </div>
                  <div class="flex items-center">
                    <span
                      class="text-lg font-bold"
                      :class="getPerformanceClass()"
                    >
                      {{ getPerformanceRating() }}
                    </span>
                    <component
                      :is="getPerformanceIcon()"
                      class="w-5 h-5 ml-2"
                      :class="getPerformanceClass()"
                    />
                  </div>
                </div>
              </div>

              <!-- Recommendations -->
              <div
                v-if="getRecommendations().length > 0"
                class="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
              >
                <h5 class="text-sm font-medium text-yellow-800 mb-2">
                  {{ t("couponStats.recommendations") }}
                </h5>
                <ul class="space-y-1">
                  <li
                    v-for="recommendation in getRecommendations()"
                    :key="recommendation"
                    class="text-sm text-yellow-700"
                  >
                    • {{ recommendation }}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-else class="mt-6 text-center py-8">
          <div
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"
          ></div>
          <p class="mt-2 text-sm text-gray-600">
            {{ t("couponStats.loading") }}
          </p>
        </div>

        <!-- Modal Footer -->
        <div class="flex justify-end pt-6 border-t mt-6">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            @click="$emit('close')"
          >
            {{ t("common.close") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/i18n";
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/vue/24/outline";

const { t } = useI18n();

interface Coupon {
  id: number;
  code: string;
  name: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usedCount: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
  createdAt: string;
}

interface CouponStats {
  totalUsed: number;
  totalDiscount: number;
  avgDiscount: number;
  lastUsed?: string;
}

interface Props {
  coupon: Coupon;
  stats: CouponStats | null;
}

const props = defineProps<Props>();
defineEmits<{
  close: [];
}>();

// Computed properties
const usageRate = computed(() => {
  if (!props.coupon?.usageLimit || !props.stats?.totalUsed) return 0;
  return Math.round((props.stats.totalUsed / props.coupon.usageLimit) * 100);
});

// Utility functions
const formatMoney = (amount: number) => {
  return (amount / 100).toFixed(2);
};

const formatDateTime = (dateString: string | undefined) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusClass = (coupon: Coupon | undefined) => {
  if (!coupon) return "";

  const now = new Date();
  const validTo = new Date(coupon.validTo);

  if (!coupon.isActive) {
    return "text-gray-600";
  } else if (now > validTo) {
    return "text-red-600";
  } else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return "text-yellow-600";
  } else {
    return "text-green-600";
  }
};

const getStatusText = (coupon: Coupon | undefined) => {
  if (!coupon) return "-";

  const now = new Date();
  const validTo = new Date(coupon.validTo);

  if (!coupon.isActive) {
    return t("couponStats.status.inactive");
  } else if (now > validTo) {
    return t("couponStats.status.expired");
  } else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return t("couponStats.status.exhausted");
  } else {
    return t("couponStats.status.active");
  }
};

const getPerformanceRating = () => {
  if (!props.stats?.totalUsed || !props.coupon)
    return t("couponStats.rating.noData");

  const usage = props.stats.totalUsed;
  const avgDiscount = props.stats.avgDiscount || 0;

  // Simple scoring algorithm
  let score = 0;

  // Usage frequency score (0-40)
  if (usage >= 50) score += 40;
  else if (usage >= 20) score += 30;
  else if (usage >= 10) score += 20;
  else if (usage >= 5) score += 10;

  // Average discount score (0-30)
  if (avgDiscount >= 2000)
    score += 30; // RM20+
  else if (avgDiscount >= 1000)
    score += 25; // RM10+
  else if (avgDiscount >= 500)
    score += 20; // RM5+
  else if (avgDiscount >= 200) score += 15; // RM2+

  // Usage rate score (0-30)
  if (props.coupon.usageLimit) {
    const rate = usageRate.value;
    if (rate >= 80) score += 30;
    else if (rate >= 60) score += 25;
    else if (rate >= 40) score += 20;
    else if (rate >= 20) score += 15;
    else if (rate >= 10) score += 10;
  } else {
    score += 20; // Unlimited usage gets partial score
  }

  if (score >= 70) return t("couponStats.rating.excellent");
  else if (score >= 50) return t("couponStats.rating.good");
  else if (score >= 30) return t("couponStats.rating.average");
  else return t("couponStats.rating.needsImprovement");
};

const getPerformanceScore = () => {
  if (!props.stats?.totalUsed || !props.coupon) return -1;
  const usage = props.stats.totalUsed;
  const avgDiscount = props.stats.avgDiscount || 0;
  let score = 0;
  if (usage >= 50) score += 40;
  else if (usage >= 20) score += 30;
  else if (usage >= 10) score += 20;
  else if (usage >= 5) score += 10;
  if (avgDiscount >= 2000) score += 30;
  else if (avgDiscount >= 1000) score += 25;
  else if (avgDiscount >= 500) score += 20;
  else if (avgDiscount >= 200) score += 15;
  if (props.coupon.usageLimit) {
    const rate = usageRate.value;
    if (rate >= 80) score += 30;
    else if (rate >= 60) score += 25;
    else if (rate >= 40) score += 20;
    else if (rate >= 20) score += 15;
    else if (rate >= 10) score += 10;
  } else {
    score += 20;
  }
  return score;
};

const getPerformanceClass = () => {
  const score = getPerformanceScore();
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-blue-600";
  if (score >= 30) return "text-yellow-600";
  if (score >= 0) return "text-red-600";
  return "text-gray-600";
};

const getPerformanceIcon = () => {
  const score = getPerformanceScore();
  if (score >= 50) return CheckCircleIcon;
  if (score >= 30) return ExclamationTriangleIcon;
  if (score >= 0) return XCircleIcon;
  return ExclamationTriangleIcon;
};

const getRecommendations = () => {
  if (!props.stats || !props.coupon) return [];

  const recommendations = [];
  const now = new Date();
  const validTo = new Date(props.coupon.validTo);
  const daysLeft = Math.ceil(
    (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Usage-based recommendations
  if (props.stats.totalUsed < 5) {
    recommendations.push(t("couponStats.recommend.lowUsage"));
  }

  // Time-based recommendations
  if (daysLeft < 7 && daysLeft > 0) {
    recommendations.push(t("couponStats.recommend.expiringSoon"));
  }

  // Usage rate recommendations
  if (props.coupon.usageLimit && usageRate.value < 20) {
    recommendations.push(t("couponStats.recommend.lowRate"));
  } else if (props.coupon.usageLimit && usageRate.value > 80) {
    recommendations.push(t("couponStats.recommend.highRate"));
  }

  // Discount optimization
  if (props.stats.avgDiscount < 500) {
    // Less than RM5
    recommendations.push(t("couponStats.recommend.lowDiscount"));
  }

  return recommendations;
};
</script>
