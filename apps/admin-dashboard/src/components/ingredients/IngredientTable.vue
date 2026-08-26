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
            <!-- Hardcoded "$" with two decimals rendered a NT$60 cost as
                 $60.00. TWD is a zero-decimal NT$ currency; formatPrice knows
                 that and every other configured currency. -->
            {{ item.costPerUnit != null ? formatPrice(item.costPerUnit) : "-" }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {{ item.supplier || "-" }}
          </td>
          <td
            class="px-6 py-4 whitespace-nowrap text-sm text-right font-medium"
            :class="stockColor(item)"
            :data-stock-state="
              item.currentStock == null
                ? 'unknown'
                : isLowStock(item)
                  ? 'low'
                  : 'ok'
            "
          >
            {{ item.currentStock != null ? item.currentStock : "-" }}
            <!-- Red text was the only signal, which a colour-blind owner
                 cannot read and a screen reader never announces. -->
            <span
              v-if="isLowStock(item)"
              class="ml-2 inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
            >
              {{ t("ingredients.lowStock") }}
            </span>
          </td>
          <td
            class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500"
          >
            {{ item.minStockLevel != null ? item.minStockLevel : "-" }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <button
              class="text-blue-600 hover:text-blue-800 text-sm mr-3"
              :data-testid="`adjust-stock-${item.id}`"
              @click="$emit('adjust', item)"
            >
              {{ t("ingredients.adjustStock") }}
            </button>
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
import { useCurrency } from "@/composables/useCurrency";
import type { IngredientDefinitionResponse } from "@makanmasak/shared-types";

const { t } = useI18n();

defineProps<{
  items: IngredientDefinitionResponse[];
}>();

const { formatPrice } = useCurrency();

defineEmits<{
  edit: [item: IngredientDefinitionResponse];
  delete: [item: IngredientDefinitionResponse];
  adjust: [item: IngredientDefinitionResponse];
}>();

/**
 * At or below the threshold counts as low. The old strict `<` rendered an
 * ingredient sitting exactly on its minimum in green, which reads as healthy
 * at the moment it stops being so.
 */
function isLowStock(item: IngredientDefinitionResponse): boolean {
  return (
    item.currentStock != null &&
    item.minStockLevel != null &&
    item.currentStock <= item.minStockLevel
  );
}

function stockColor(item: IngredientDefinitionResponse): string {
  if (item.currentStock == null) return "text-gray-500";
  return isLowStock(item) ? "text-red-600" : "text-green-600";
}
</script>
