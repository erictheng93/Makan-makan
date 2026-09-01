<template>
  <div v-if="alerts.length > 0" class="space-y-3">
    <div
      v-for="(alert, index) in alerts"
      :key="index"
      class="flex items-start gap-3 p-4 rounded-lg border"
      :class="alertStyles[alert.severity]"
    >
      <div class="flex-shrink-0 mt-0.5">
        <ExclamationTriangleIcon
          v-if="alert.severity === 'critical'"
          class="h-5 w-5 text-red-600"
        />
        <ExclamationCircleIcon
          v-else-if="alert.severity === 'warning'"
          class="h-5 w-5 text-yellow-600"
        />
        <InformationCircleIcon v-else class="h-5 w-5 text-blue-600" />
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="typeStyles[alert.type]"
          >
            {{ typeLabels[alert.type] }}
          </span>
          <span class="text-sm font-medium text-gray-900">
            {{ alert.ingredientName || alert.menuItemName }}
          </span>
        </div>
        <p class="mt-1 text-sm text-gray-600">{{ alertMessage(alert) }}</p>
      </div>
    </div>
  </div>
  <div v-else class="text-center py-6 text-gray-500 text-sm">
    {{ t("forecast.noAlerts") }}
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@/i18n";
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from "@heroicons/vue/24/outline";
import type { ForecastAlert } from "@makanmasak/shared-types";

const { t } = useI18n();

defineProps<{
  alerts: ForecastAlert[];
}>();

function alertMessage(alert: ForecastAlert): string {
  return alert.messageKey
    ? t(alert.messageKey, alert.messageParams ?? {})
    : alert.message;
}

const alertStyles: Record<string, string> = {
  critical: "bg-red-50 border-red-200",
  warning: "bg-yellow-50 border-yellow-200",
  info: "bg-blue-50 border-blue-200",
};

// Five alert types on a five-hue palette. `procurement_needed` was amber and
// `high_demand` orange -- distinct in Tailwind's palette, identical in ours,
// since amber resolves to orange here. It takes blue instead: it is the one
// entry that asks for an action rather than reporting a condition.
// `excess_stock` and `unusual_spike` are both teal data anomalies, so they
// separate by depth rather than hue.
const typeStyles: Record<string, string> = {
  high_demand: "bg-orange-100 text-orange-800",
  low_stock: "bg-red-100 text-red-800",
  unusual_spike: "bg-teal-200 text-teal-900",
  procurement_needed: "bg-blue-100 text-blue-800",
  excess_stock: "bg-teal-50 text-teal-700",
};

const typeLabels: Record<string, string> = {
  high_demand: t("forecast.alertHighDemand"),
  low_stock: t("forecast.alertLowStock"),
  unusual_spike: t("forecast.alertUnusualSpike"),
  procurement_needed: t("forecast.alertProcurementNeeded"),
  excess_stock: t("forecast.alertExcessStock"),
};
</script>
