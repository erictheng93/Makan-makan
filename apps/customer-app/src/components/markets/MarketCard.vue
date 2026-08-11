<template>
  <article
    class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
  >
    <button
      type="button"
      class="block w-full text-left focus:outline-none focus:ring-2 focus:ring-ios-blue focus:ring-offset-2"
      @click="$emit('select', market)"
    >
      <div class="h-32 bg-gray-100">
        <img
          v-if="heroImageUrl"
          :src="heroImageUrl"
          :alt="market.name"
          class="h-full w-full object-cover"
          data-testid="market-card-image"
        />
        <div
          v-else
          class="flex h-full items-center justify-center bg-gray-100 text-sm text-gray-500"
        >
          {{ market.name }}
        </div>
      </div>
      <div class="space-y-2 p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="truncate text-base font-semibold text-gray-900">
              {{ market.name }}
            </h2>
            <div class="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                data-testid="market-card-type"
                class="rounded-full bg-ios-blue/10 px-2 py-0.5 text-xs font-medium text-ios-blue"
              >
                {{ typeLabel }}
              </span>
              <span class="text-sm text-gray-500">
                {{ market.city }} · {{ market.district }}
              </span>
            </div>
          </div>
          <span class="shrink-0 text-sm font-medium text-ios-blue">
            {{ vendorLabel }}
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span
            v-if="todayStatusLabel"
            class="rounded-full px-2.5 py-1 text-xs font-medium"
            :class="
              isOpenToday
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-600'
            "
          >
            {{ todayStatusLabel }}
          </span>
          <span v-if="todayHoursLabel" class="text-xs text-gray-500">
            {{ todayHoursLabel }}
          </span>
        </div>
        <div
          v-if="catalogCoverage"
          data-testid="market-card-catalog"
          class="flex flex-wrap gap-2 text-xs"
        >
          <template v-if="hasSearchableCatalog">
            <span
              class="rounded-full bg-ios-blue/10 px-2.5 py-1 font-medium text-ios-blue"
            >
              {{
                tWithParams("markets.card.productCount", {
                  count: catalogCoverage.searchableProductCount,
                })
              }}
            </span>
            <span
              class="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700"
            >
              {{
                tWithParams("markets.card.serviceCount", {
                  count: catalogCoverage.publicServiceCount,
                })
              }}
            </span>
          </template>
          <span v-else class="text-gray-500">
            {{ t("markets.card.catalogPending") }}
          </span>
        </div>
        <div
          v-if="publicReadinessLabel"
          data-testid="market-card-readiness"
          class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
        >
          {{ publicReadinessLabel }}
        </div>
        <p
          v-if="market.description"
          class="line-clamp-2 text-sm leading-5 text-gray-600"
        >
          {{ market.description }}
        </p>
        <p v-if="distanceLabel" class="text-xs font-medium text-gray-500">
          {{ distanceLabel }}
        </p>
        <div
          data-testid="market-card-explore-status"
          class="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm"
        >
          <span
            class="font-medium"
            :class="hasSearchableCatalog ? 'text-ios-blue' : 'text-gray-500'"
          >
            {{ exploreStatusLabel }}
          </span>
          <span class="text-xs text-gray-400">{{
            t("markets.card.viewMarket")
          }}</span>
        </div>
      </div>
    </button>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MarketListItem } from "@/services/marketsApi";
import { marketTypeLabelKey } from "@/utils/marketTypes";
import { useI18n } from "@/composables/useI18n";

const props = defineProps<{
  market: MarketListItem & { distanceKm?: number };
}>();

defineEmits<{
  select: [market: MarketListItem];
}>();

const { t, tWithParams } = useI18n();

const vendorLabel = computed(() =>
  tWithParams("markets.common.stallCount", {
    count: props.market.vendorCount ?? 0,
  }),
);
const typeLabel = computed(() => t(marketTypeLabelKey(props.market.type)));
const distanceLabel = computed(() =>
  props.market.distanceKm == null
    ? ""
    : tWithParams("markets.card.distance", {
        km: props.market.distanceKm.toFixed(1),
      }),
);
const heroImageUrl = computed(
  () =>
    props.market.bannerUrl ||
    props.market.logoUrl ||
    props.market.imageUrls?.[0] ||
    "",
);
const catalogCoverage = computed(() => props.market.catalogCoverage ?? null);
const hasSearchableCatalog = computed(
  () =>
    (catalogCoverage.value?.searchableProductCount ?? 0) > 0 ||
    (catalogCoverage.value?.publicServiceCount ?? 0) > 0,
);
const publicReadinessLabel = computed(() => {
  const readiness = props.market.publicReadiness;
  if (!readiness || readiness.ready) return "";

  return tWithParams("markets.card.readiness", {
    done: readiness.completedCount,
    total: readiness.totalCount,
  });
});
const exploreStatusLabel = computed(() =>
  hasSearchableCatalog.value
    ? t("markets.card.enterSearch")
    : t("markets.common.dataPending"),
);

const weekdayKeys = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const todayHours = computed(() => {
  const key = weekdayKeys[new Date().getDay()];
  return props.market.openingHours?.[key] ?? null;
});

const isOpenToday = computed(() => {
  const hours = todayHours.value;
  if (!hours || hours.closed) return false;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [openHour, openMinute] = hours.open.split(":").map(Number);
  const [closeHour, closeMinute] = hours.close.split(":").map(Number);
  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;

  if (closeMinutes < openMinutes) {
    return nowMinutes >= openMinutes || nowMinutes <= closeMinutes;
  }
  return nowMinutes >= openMinutes && nowMinutes <= closeMinutes;
});

const todayStatusLabel = computed(() => {
  const hours = todayHours.value;
  if (!hours) return "";
  if (hours.closed) return t("markets.common.closedToday");
  return isOpenToday.value
    ? t("markets.common.open")
    : t("markets.common.closed");
});

const todayHoursLabel = computed(() => {
  const hours = todayHours.value;
  if (!hours || hours.closed) return "";
  return isOpenToday.value
    ? tWithParams("markets.card.until", { time: hours.close })
    : `${hours.open}-${hours.close}`;
});
</script>
