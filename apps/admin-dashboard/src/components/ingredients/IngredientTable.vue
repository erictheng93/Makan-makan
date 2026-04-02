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
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("ingredients.category") }}
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("ingredients.costPerUnit") }}
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("ingredients.supplier") }}
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("ingredients.currentStock") }}
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("ingredients.minStock") }}
          </th>
          <th
            class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("common.actions") }}
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr v-for="item in items" :key="item.id" class="hover:bg-gray-50">
          <td
            class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
          >
            {{ item.name }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {{ item.unit }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {{ item.category || "-" }}
          </td>
          <td
            class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500"
          >
            {{
              item.costPerUnit != null ? `$${item.costPerUnit.toFixed(2)}` : "-"
            }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {{ item.supplier || "-" }}
          </td>
          <td
            class="px-6 py-4 whitespace-nowrap text-sm text-right font-medium"
            :class="stockColor(item)"
          >
            {{ item.currentStock != null ? item.currentStock : "-" }}
          </td>
          <td
            class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500"
          >
            {{ item.minStockLevel != null ? item.minStockLevel : "-" }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <button
              class="text-blue-600 hover:text-blue-800 text-sm mr-3"
              @click="$emit('edit', item)"
            >
              {{ t("common.edit") }}
            </button>
            <button
              class="text-red-600 hover:text-red-800 text-sm"
              @click="$emit('delete', item)"
            >
              {{ t("common.delete") }}
            </button>
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="8" class="px-6 py-8 text-center text-gray-500">
            {{ t("common.noData") }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@/i18n";
import type { IngredientDefinitionResponse } from "@makanmakan/shared-types";

const { t } = useI18n();

defineProps<{
  items: IngredientDefinitionResponse[];
}>();

defineEmits<{
  edit: [item: IngredientDefinitionResponse];
  delete: [item: IngredientDefinitionResponse];
}>();

function stockColor(item: IngredientDefinitionResponse): string {
  if (item.currentStock == null) return "text-gray-500";
  if (item.minStockLevel != null && item.currentStock < item.minStockLevel) {
    return "text-red-600";
  }
  return "text-green-600";
}
</script>
