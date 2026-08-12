<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="relative sm:w-80">
        <select
          v-model="selectedRestaurantId"
          class="w-full appearance-none rounded-xl border-0 bg-white px-4 py-3 text-sm text-[#1C1C1E] shadow-sm focus:ring-2 focus:ring-[#007AFF]/30"
          @change="loadUsage"
        >
          <option value="">{{ t("usage.selectRestaurant") }}</option>
          <option
            v-for="sub in subscriptions"
            :key="sub.restaurantId"
            :value="sub.restaurantId"
          >
            {{ sub.restaurantId }} · {{ sub.planTier }}
          </option>
        </select>
        <ChevronDown
          class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]"
        />
      </div>
      <button
        class="inline-flex items-center justify-center gap-2 rounded-full bg-[#007AFF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0071E3] disabled:opacity-50"
        :disabled="!selectedRestaurantId || isLoading"
        @click="loadUsage"
      >
        <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
        {{ t("usage.refresh") }}
      </button>
    </div>

    <div
      v-if="!selectedRestaurantId"
      class="rounded-2xl bg-white p-10 text-center text-sm text-[#8E8E93] shadow-sm"
    >
      {{ t("usage.emptyPrompt") }}
    </div>

    <div
      v-else-if="isLoading"
      class="flex items-center justify-center rounded-2xl bg-white py-16 shadow-sm"
    >
      <div
        class="h-8 w-8 animate-spin rounded-full border-2 border-[#007AFF] border-t-transparent"
      />
    </div>

    <div
      v-else-if="errorMessage"
      class="rounded-2xl bg-white p-8 text-center shadow-sm"
    >
      <AlertCircle class="mx-auto mb-3 h-10 w-10 text-[#FF3B30]" />
      <p class="text-sm font-medium text-[#1C1C1E]">{{ errorMessage }}</p>
    </div>

    <template v-else>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="meter in currentMeters"
          :key="meter.meterKey"
          class="rounded-2xl bg-white p-4 shadow-sm"
        >
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-[#1C1C1E]">
                {{ meterLabel(meter.meterKey) }}
              </p>
              <p class="font-mono text-xs text-[#8E8E93]">
                {{ meter.meterKey }}
              </p>
            </div>
            <span class="text-sm font-semibold text-[#1C1C1E]">
              {{ formatQuantity(meter.meterKey, meter.total) }}
            </span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-[#E5E5EA]">
            <div
              class="h-full rounded-full transition-all"
              :class="barClass(meter.percentage)"
              :style="{ width: barWidth(meter.percentage) }"
            />
          </div>
          <p class="mt-2 text-xs text-[#8E8E93]">
            {{ limitLabel(meter) }}
          </p>
        </div>
      </div>

      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-[#1C1C1E]">
            {{ t("usage.recentEvents") }}
          </h2>
          <span class="text-xs text-[#8E8E93]">
            {{ t("usage.eventsCount", { count: eventsTotal }) }}
          </span>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-left text-sm">
            <thead>
              <tr class="border-b border-[#E5E5EA] text-xs text-[#8E8E93]">
                <th class="py-2 pr-4 font-medium">
                  {{ t("usage.columnTime") }}
                </th>
                <th class="py-2 pr-4 font-medium">
                  {{ t("usage.columnMeter") }}
                </th>
                <th class="py-2 pr-4 font-medium">
                  {{ t("usage.columnQuantity") }}
                </th>
                <th class="py-2 font-medium">{{ t("usage.columnStatus") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="event in events"
                :key="event.id"
                class="border-b border-[#F2F2F7] text-[#1C1C1E]"
              >
                <td class="py-2 pr-4 whitespace-nowrap">
                  {{ formatDate(event.occurredAt) }}
                </td>
                <td class="py-2 pr-4 font-mono text-xs">
                  {{ event.meterKey }}
                </td>
                <td class="py-2 pr-4">
                  {{ formatQuantity(event.meterKey, event.quantity) }}
                </td>
                <td class="py-2">
                  <span
                    class="rounded-full px-2 py-1 text-xs"
                    :class="
                      event.aggregatedAt
                        ? 'bg-[#34C759]/10 text-[#34C759]'
                        : 'bg-[#FF9500]/10 text-[#FF9500]'
                    "
                  >
                    {{
                      event.aggregatedAt
                        ? t("usage.statusAggregated")
                        : t("usage.statusPending")
                    }}
                  </span>
                </td>
              </tr>
              <tr v-if="events.length === 0">
                <td class="py-8 text-center text-[#8E8E93]" colspan="4">
                  {{ t("usage.noEvents") }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { AlertCircle, ChevronDown, RefreshCw } from "lucide-vue-next";
import {
  subscriptionService,
  type MeterKey,
  type Subscription,
  type UsageEvent,
  type UsageMeterProgress,
} from "@/services/subscriptionService";
import { useDateFormatter } from "@/composables/useDateFormatter";
import { useI18n } from "@/i18n";

const { formatShortDateTime } = useDateFormatter();
const { t, locale } = useI18n();

const props = defineProps<{
  subscriptions: Subscription[];
}>();

const selectedRestaurantId = ref("");
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);
const events = ref<UsageEvent[]>([]);
const eventsTotal = ref(0);
const currentMeters = ref<UsageMeterProgress[]>([]);

watch(
  () => props.subscriptions,
  (subscriptions) => {
    if (!selectedRestaurantId.value && subscriptions.length > 0) {
      selectedRestaurantId.value = subscriptions[0].restaurantId;
      loadUsage();
    }
  },
  { immediate: true },
);

async function loadUsage() {
  if (!selectedRestaurantId.value) return;

  isLoading.value = true;
  errorMessage.value = null;
  try {
    const [usage, eventPage] = await Promise.all([
      subscriptionService.getUsage(selectedRestaurantId.value),
      subscriptionService.getUsageEvents(selectedRestaurantId.value, {
        limit: 20,
      }),
    ]);
    currentMeters.value = usage.current.meters;
    events.value = eventPage.events;
    eventsTotal.value = eventPage.total;
  } catch (err: unknown) {
    errorMessage.value =
      err?.response?.data?.error?.message ?? t("usage.loadError");
  } finally {
    isLoading.value = false;
  }
}

function meterLabel(meterKey: MeterKey) {
  const labels: Record<MeterKey, string> = {
    "orders.created": t("usage.meters.ordersCreated"),
    "api.requests": t("usage.meters.apiRequests"),
    "print.jobs": t("usage.meters.printJobs"),
    "ai.requests": t("usage.meters.aiRequests"),
    "storage.bytes": t("usage.meters.storageBytes"),
  };
  return labels[meterKey];
}

function formatQuantity(meterKey: MeterKey, value: number) {
  if (meterKey === "storage.bytes") {
    if (value >= 1_000_000_000)
      return `${(value / 1_000_000_000).toFixed(1)} GB`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} MB`;
  }
  // Plain grouping in the UI language — this is a usage count, not money, so it
  // must not go through useCurrency()/formatPrice and gain a currency symbol.
  return new Intl.NumberFormat(locale.value).format(value);
}

function limitLabel(meter: UsageMeterProgress) {
  if (!meter.hardLimit) return t("usage.noLimit");
  return `${formatQuantity(meter.meterKey, meter.total)} / ${formatQuantity(
    meter.meterKey,
    meter.hardLimit,
  )}`;
}

function barWidth(percentage: number | null) {
  if (percentage === null) return "0%";
  return `${Math.min(100, Math.round(percentage * 100))}%`;
}

function barClass(percentage: number | null) {
  if (percentage !== null && percentage >= 1) return "bg-[#FF3B30]";
  if (percentage !== null && percentage >= 0.8) return "bg-[#FF9500]";
  return "bg-[#34C759]";
}

function formatDate(ms: number) {
  // Local wrapper kept: the composable accepts Date | string, not a number.
  return formatShortDateTime(new Date(ms));
}
</script>
