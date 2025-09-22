<template>
  <div
    v-if="recommendedCoupons.length > 0"
    class="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-200"
  >
    <div class="flex items-center space-x-2 mb-3">
      <svg
        class="w-5 h-5 text-indigo-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h4 class="text-sm font-semibold text-indigo-800">
        {{ t("cart.recommendedForYou") }}
      </h4>
    </div>

    <div class="space-y-2">
      <div
        v-for="coupon in recommendedCoupons"
        :key="coupon.id"
        class="bg-white rounded-lg p-3 border border-indigo-100 hover:shadow-sm transition-shadow cursor-pointer"
        @click="$emit('select-coupon', coupon)"
      >
        <div class="flex justify-between items-center">
          <div class="flex-1">
            <div class="flex items-center space-x-2">
              <span class="font-medium text-gray-900">{{ coupon.name }}</span>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
              >
                {{ formatDiscount(coupon) }}
              </span>
            </div>
            <p class="text-xs text-gray-600 mt-1">{{ coupon.description }}</p>
            <div class="text-xs text-indigo-600 mt-1">
              {{ t("cart.potentialSaving") }}: ${{
                calculatePotentialSaving(coupon)
              }}
            </div>
          </div>
          <button
            class="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
          >
            {{ t("cart.use") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

const props = defineProps<{
  coupons: any[];
  orderAmount: number;
}>();

defineEmits<{
  "select-coupon": [coupon: any];
}>();

const recommendedCoupons = computed(() => {
  return props.coupons
    .filter((coupon) => {
      // 推荐逻辑：订单金额满足最低要求，且能带来实际折扣
      const meetsMinOrder =
        !coupon.minOrderAmount || props.orderAmount >= coupon.minOrderAmount;
      const hasDiscount = Number(calculatePotentialSaving(coupon)) > 0;
      return meetsMinOrder && hasDiscount;
    })
    .sort(
      (a, b) =>
        Number(calculatePotentialSaving(b)) -
        Number(calculatePotentialSaving(a)),
    )
    .slice(0, 2); // 只显示最优的2个推荐
});

const formatDiscount = (coupon: any) => {
  if (coupon.discountType === "percentage") {
    return `${coupon.discountValue}% ${t("common.off")}`;
  } else {
    return `$${coupon.discountValue.toFixed(2)} ${t("common.off")}`;
  }
};

const calculatePotentialSaving = (coupon: any): string => {
  let saving = 0;

  if (coupon.discountType === "percentage") {
    saving = Math.round(props.orderAmount * (coupon.discountValue / 100));
    if (coupon.maxDiscountAmount && saving > coupon.maxDiscountAmount) {
      saving = coupon.maxDiscountAmount;
    }
  } else {
    saving = Number(coupon.discountValue);
  }

  return Math.min(saving, props.orderAmount).toFixed(2);
};
</script>
