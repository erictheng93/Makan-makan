<template>
  <div class="bg-white rounded-lg shadow p-6">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-lg font-semibold text-gray-900">
        {{ t("forecast.procurementList") }}
      </h3>
      <button
        class="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
        @click="exportCSV"
      >
        {{ t("forecast.exportCSV") }}
      </button>
    </div>

    <div
      v-if="groupedItems.length === 0"
      class="text-center py-6 text-gray-400 text-sm"
    >
      {{ t("forecast.noProcurementData") }}
    </div>

    <div
      v-for="group in groupedItems"
      :key="group.supplier"
      class="mb-6 last:mb-0"
    >
      <h4
        class="text-sm font-medium text-gray-700 mb-2 bg-gray-50 px-3 py-2 rounded"
      >
        {{ group.supplier || t("forecast.noSupplier") }}
      </h4>
      <table class="min-w-full">
        <tbody>
          <tr
            v-for="item in group.items"
            :key="item.ingredientId"
            class="border-b border-gray-100 last:border-b-0"
          >
            <td class="py-2 text-sm text-gray-900">
              {{ item.ingredientName }}
            </td>
            <td class="py-2 text-sm text-right text-red-600 font-medium">
              {{ item.gap }} {{ item.unit }}
            </td>
            <td class="py-2 text-sm text-right text-gray-500">
              {{
                item.estimatedCost != null
                  ? `$${item.estimatedCost.toFixed(2)}`
                  : "-"
              }}
            </td>
          </tr>
        </tbody>
      </table>
      <div class="text-right text-sm font-medium text-gray-700 mt-1 px-2">
        {{ t("forecast.subtotal") }}: ${{ group.totalCost.toFixed(2) }}
      </div>
    </div>

    <div v-if="groupedItems.length > 0" class="mt-4 pt-4 border-t text-right">
      <span class="text-lg font-bold text-gray-900">
        {{ t("forecast.totalEstimatedCost") }}: ${{ totalCost.toFixed(2) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/i18n";
import type { IngredientForecastItem } from "@makanmasak/shared-types";

const { t } = useI18n();

const props = defineProps<{
  items: IngredientForecastItem[];
  ingredientDetails: Map<
    number,
    { supplier: string | null; costPerUnit: number | null }
  >;
}>();

interface ProcurementItem {
  ingredientId: number;
  ingredientName: string;
  unit: string;
  gap: number;
  estimatedCost: number | null;
}

interface ProcurementGroup {
  supplier: string;
  items: ProcurementItem[];
  totalCost: number;
}

const procurementItems = computed<ProcurementItem[]>(() =>
  props.items
    .filter((item) => item.gap != null && item.gap > 0)
    .map((item) => {
      const details = props.ingredientDetails.get(item.ingredientId);
      const costPerUnit = details?.costPerUnit;
      return {
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        unit: item.unit,
        gap: item.gap!,
        estimatedCost: costPerUnit != null ? costPerUnit * item.gap! : null,
      };
    }),
);

const groupedItems = computed<ProcurementGroup[]>(() => {
  const groups = new Map<string, ProcurementItem[]>();
  for (const item of procurementItems.value) {
    const details = props.ingredientDetails.get(item.ingredientId);
    const supplier = details?.supplier || "";
    if (!groups.has(supplier)) groups.set(supplier, []);
    groups.get(supplier)!.push(item);
  }
  return Array.from(groups.entries()).map(([supplier, items]) => ({
    supplier,
    items,
    totalCost: items.reduce((sum, i) => sum + (i.estimatedCost || 0), 0),
  }));
});

const totalCost = computed(() =>
  groupedItems.value.reduce((sum, g) => sum + g.totalCost, 0),
);

function exportCSV() {
  const header = "Supplier,Ingredient,Quantity,Unit,Estimated Cost\n";
  const rows = procurementItems.value
    .map((item) => {
      const details = props.ingredientDetails.get(item.ingredientId);
      return `"${details?.supplier || ""}","${item.ingredientName}",${item.gap},"${item.unit}",${item.estimatedCost?.toFixed(2) || ""}`;
    })
    .join("\n");

  const blob = new Blob(["\uFEFF" + header + rows], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `procurement-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>
