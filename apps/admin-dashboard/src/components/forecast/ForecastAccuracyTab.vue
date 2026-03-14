<template>
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <h3 class="text-lg font-medium text-gray-900">
        {{ t("forecast.accuracyReport") }}
      </h3>
      <p class="text-sm text-gray-500">
        {{ t("forecast.accuracyDescription") }}
      </p>
    </div>
    <div v-if="loading" class="flex justify-center py-12">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
      ></div>
    </div>
    <table v-else class="min-w-full divide-y divide-gray-200">
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
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.actual") }}
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.deviation") }}
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200">
        <tr
          v-for="item in items"
          :key="item.menuItemId"
          class="hover:bg-gray-50"
        >
          <td class="px-6 py-4 text-sm font-medium text-gray-900">
            {{ item.menuItemName }}
          </td>
          <td class="px-6 py-4 text-sm text-right text-gray-700">
            {{ item.predicted }}
          </td>
          <td class="px-6 py-4 text-sm text-right text-gray-700">
            {{ item.actual }}
          </td>
          <td
            class="px-6 py-4 text-sm text-right font-medium"
            :class="deviationColor(item.deviation)"
          >
            {{ item.deviation.toFixed(1) }}%
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="4" class="px-6 py-8 text-center text-gray-500">
            {{ t("forecast.noAccuracyData") }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { ForecastAccuracyItem } from "@makanmakan/shared-types";

const { t } = useI18n();

defineProps<{
  items: ForecastAccuracyItem[];
  loading: boolean;
}>();

function deviationColor(deviation: number): string {
  if (deviation <= 10) return "text-green-600";
  if (deviation <= 25) return "text-yellow-600";
  return "text-red-600";
}
</script>
