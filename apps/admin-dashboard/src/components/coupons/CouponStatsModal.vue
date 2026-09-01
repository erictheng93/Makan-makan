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
                      ({{ t("couponStats.maxDiscount") }}
                      {{ formatPrice(coupon?.maxDiscountAmount || 0) }})
                    </span>
                  </span>
                  <span v-else>
                    {{ formatPrice(coupon?.discountValue || 0) }}
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
                  {{ formatOptionalDateTime(coupon?.validFrom) }}
                </p>
                <p class="text-sm">
                  <span class="font-medium">{{ t("couponStats.end") }}:</span>
                  {{ formatOptionalDateTime(coupon?.validTo) }}
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
                  {{ formatPrice(stats.totalDiscount || 0) }}
                </div>
                <div class="text-sm text-green-700">
                  {{ t("couponStats.totalDiscount") }}
                </div>
              </div>

              <div class="bg-teal-50 rounded-lg p-4">
                <div class="text-2xl font-bold text-teal-600">
                  {{ formatPrice(stats.avgDiscount || 0) }}
                </div>
                <div class="text-sm text-teal-700">
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
                    {{ formatOptionalDateTime(stats.lastUsed) }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-sm font-medium text-gray-700">
                    {{ t("couponStats.createdAt") }}
                  </p>
                  <p class="text-sm text-gray-600">
                    {{ formatOptionalDateTime(coupon?.createdAt) }}
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
                    <span class="text-lg font-bold" :class="performanceClass">
                      {{ performanceRating }}
                    </span>
                    <component
                      :is="performanceIcon"
                      class="w-5 h-5 ml-2"
                      :class="performanceClass"
                    />
                  </div>
                </div>
              </div>

              <!-- Recommendations -->
              <div
                v-if="recommendations.length > 0"
                class="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
              >
                <h5 class="text-sm font-medium text-yellow-800 mb-2">
                  {{ t("couponStats.recommendations") }}
                </h5>
                <ul class="space-y-1">
                  <li
                    v-for="recommendation in recommendations"
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
            class="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"
          ></div>
          <p class="mt-2 text-sm text-gray-600">
            {{ t("couponStats.loading") }}
          </p>
        </div>

        <!-- Modal Footer -->
        <div class="flex justify-end pt-6 border-t mt-6">
          <button
            type="button"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
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
import { useCurrency } from "@/composables/useCurrency";
import { useDateFormatter } from "@/composables/useDateFormatter";
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
} from "@heroicons/vue/24/outline";

const { t } = useI18n();
const { formatPrice } = useCurrency();
const { formatDateTime } = useDateFormatter();

import type { Coupon, CouponDetailStats } from "@makanmasak/shared-types";

interface Props {
  coupon: Coupon;
  stats: CouponDetailStats | null;
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
const formatOptionalDateTime = (dateString: string | undefined) => {
  if (!dateString) return "-";
  return formatDateTime(dateString);
};

import {
  type CouponStatus,
  getCouponStatus as _getCouponStatus,
} from "@/utils/couponStatus";

const getCouponStatus = (coupon: Coupon | undefined): CouponStatus | null => {
  if (!coupon) return null;
  return _getCouponStatus(coupon);
};

const statusTextClassMap: Record<CouponStatus, string> = {
  inactive: "text-gray-600",
  expired: "text-red-600",
  exhausted: "text-yellow-600",
  scheduled: "text-blue-600",
  active: "text-green-600",
};

const getStatusClass = (coupon: Coupon | undefined) => {
  const status = getCouponStatus(coupon);
  return status ? statusTextClassMap[status] : "";
};

const getStatusText = (coupon: Coupon | undefined) => {
  const status = getCouponStatus(coupon);
  return status ? t(`couponStats.status.${status}`) : "-";
};

const performanceScore = computed(() => {
  if (!props.stats?.totalUsed || !props.coupon) return -1;
  const usage = props.stats.totalUsed;
  const avgDiscount = props.stats.avgDiscount || 0;
  let score = 0;

  // Usage frequency score (0-40)
  if (usage >= 50) score += 40;
  else if (usage >= 20) score += 30;
  else if (usage >= 10) score += 20;
  else if (usage >= 5) score += 10;

  // Average discount score (0-30)
  // avgDiscount is already a display-currency amount, not cents.
  if (avgDiscount >= 20) score += 30;
  else if (avgDiscount >= 10) score += 25;
  else if (avgDiscount >= 5) score += 20;
  else if (avgDiscount >= 2) score += 15;

  // Usage rate score (0-30)
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
});

const performanceRating = computed(() => {
  const score = performanceScore.value;
  if (score < 0) return t("couponStats.rating.noData");
  if (score >= 70) return t("couponStats.rating.excellent");
  if (score >= 50) return t("couponStats.rating.good");
  if (score >= 30) return t("couponStats.rating.average");
  return t("couponStats.rating.needsImprovement");
});

const performanceClass = computed(() => {
  const score = performanceScore.value;
  if (score >= 70) return "text-green-600";
  if (score >= 50) return "text-blue-600";
  if (score >= 30) return "text-yellow-600";
  if (score >= 0) return "text-red-600";
  return "text-gray-600";
});

const performanceIcon = computed(() => {
  const score = performanceScore.value;
  if (score >= 50) return CheckCircleIcon;
  if (score >= 30) return ExclamationTriangleIcon;
  if (score >= 0) return XCircleIcon;
  return ExclamationTriangleIcon;
});

const recommendations = computed(() => {
  if (!props.stats || !props.coupon) return [];

  const result: string[] = [];
  const now = new Date();
  const validTo = new Date(props.coupon.validTo);
  const daysLeft = Math.ceil(
    (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (props.stats.totalUsed < 5) {
    result.push(t("couponStats.recommend.lowUsage"));
  }

  if (daysLeft < 7 && daysLeft > 0) {
    result.push(t("couponStats.recommend.expiringSoon"));
  }

  if (props.coupon.usageLimit && usageRate.value < 20) {
    result.push(t("couponStats.recommend.lowRate"));
  } else if (props.coupon.usageLimit && usageRate.value > 80) {
    result.push(t("couponStats.recommend.highRate"));
  }

  if (props.stats.avgDiscount < 5) {
    result.push(t("couponStats.recommend.lowDiscount"));
  }

  return result;
});
</script>
