<template>
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.menuItem") }}
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.predicted") }}
          </th>
          <th
            class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.confidence") }}
          </th>
          <th
            class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.trend") }}
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.historicalAvg") }}
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr
          v-for="item in items"
          :key="item.menuItemId"
          class="hover:bg-gray-50"
        >
          <td
            class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
          >
            {{ item.menuItemName }}
          </td>
          <td
            class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold"
          >
            {{ Math.ceil(item.predicted) }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center justify-center gap-2">
              <div class="w-20 bg-gray-200 rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all"
                  :class="confidenceColor(item.confidence)"
                  :style="{ width: `${item.confidence * 100}%` }"
                ></div>
              </div>
              <span class="text-xs text-gray-500"
                >{{ Math.round(item.confidence * 100) }}%</span
              >
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <span
              class="inline-flex items-center gap-1 text-sm font-medium"
              :class="{
                'text-green-600': item.trend === 'up',
                'text-red-600': item.trend === 'down',
                'text-gray-500': item.trend === 'stable',
              }"
            >
              <span v-if="item.trend === 'up'">↑</span>
              <span v-else-if="item.trend === 'down'">↓</span>
              <span v-else>→</span>
              {{ Math.abs(item.trendPercent).toFixed(1) }}%
            </span>
          </td>
          <td
            class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500"
          >
            {{ item.historicalAvg.toFixed(1) }}
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="5" class="px-6 py-8 text-center text-gray-500">
            {{ t("forecast.noData") }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { ForecastItemResult } from "@makanmakan/shared-types";

const { t } = useI18n();

defineProps<{
  items: ForecastItemResult[];
}>();

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-500";
  if (confidence >= 0.5) return "bg-yellow-500";
  return "bg-red-500";
}
</script>
