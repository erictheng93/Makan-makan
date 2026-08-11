<template>
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("ingredients.name") }}
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("ingredients.unit") }}
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.predictedQuantity") }}
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("ingredients.currentStock") }}
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.gap") }}
          </th>
          <th
            class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.confidence") }}
          </th>
          <th
            class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.details") }}
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <template v-for="item in items" :key="item.ingredientId">
          <tr class="hover:bg-gray-50">
            <td
              class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
            >
              {{ item.ingredientName }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ item.unit }}
            </td>
            <td
              class="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900"
            >
              {{ item.predictedQuantity }}
            </td>
            <td
              class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500"
            >
              {{ item.currentStock != null ? item.currentStock : "-" }}
            </td>
            <td
              class="px-6 py-4 whitespace-nowrap text-sm text-right font-medium"
              :class="gapColor(item)"
            >
              {{ item.gap != null && item.gap > 0 ? `+${item.gap}` : "-" }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="flex items-center justify-center gap-2">
                <div class="w-16 bg-gray-200 rounded-full h-2">
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
              <button
                class="text-blue-600 hover:text-blue-800 text-xs"
                @click="toggleExpand(item.ingredientId)"
              >
                {{
                  expandedIds.has(item.ingredientId)
                    ? t("common.hideDetails")
                    : t("common.showDetails")
                }}
              </button>
            </td>
          </tr>
          <!-- Expanded contributing items -->
          <tr v-if="expandedIds.has(item.ingredientId)">
            <td colspan="7" class="px-8 py-3 bg-gray-50">
              <div class="text-xs text-gray-500 mb-1 font-medium">
                {{ t("forecast.contributingItems") }}:
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="contrib in item.contributingItems"
                  :key="contrib.menuItemId"
                  class="text-xs text-gray-600"
                >
                  {{ contrib.menuItemName }}: {{ contrib.quantity }}
                  {{ item.unit }}
                </div>
              </div>
            </td>
          </tr>
        </template>
        <tr v-if="items.length === 0">
          <td colspan="7" class="px-6 py-8 text-center text-gray-500">
            {{ t("forecast.noData") }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "@/i18n";
import type { IngredientForecastItem } from "@makanmasak/shared-types";

const { t } = useI18n();

defineProps<{
  items: IngredientForecastItem[];
}>();

const expandedIds = ref(new Set<number>());

function toggleExpand(id: number) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id);
  } else {
    expandedIds.value.add(id);
  }
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-500";
  if (confidence >= 0.5) return "bg-yellow-500";
  return "bg-red-500";
}

function gapColor(item: IngredientForecastItem): string {
  if (item.gap == null || item.gap <= 0) return "text-gray-400";
  return "text-red-600";
}
</script>
