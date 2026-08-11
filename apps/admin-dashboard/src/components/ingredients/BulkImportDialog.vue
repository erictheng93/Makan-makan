<template>
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
      <h3 class="text-lg font-semibold mb-4">
        {{ t("ingredients.bulkImport") }}
      </h3>

      <div class="mb-4">
        <p class="text-sm text-gray-600 mb-2">
          {{ t("ingredients.bulkImportDesc") }}
        </p>
        <p class="text-xs text-gray-400 mb-3">
          CSV {{ t("ingredients.bulkImportFormat") }}: name, unit, category,
          costPerUnit, supplier, minStockLevel, currentStock
        </p>
        <textarea
          v-model="csvContent"
          rows="10"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="雞胸肉,kg,肉類,120,王記肉鋪,5,10&#10;洋蔥,kg,蔬菜,30,菜市場,3,8&#10;醬油,ml,調味料,15,,2,5"
        ></textarea>
      </div>

      <div
        v-if="parseError"
        class="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg"
      >
        {{ parseError }}
      </div>

      <div
        v-if="parsed.length > 0"
        class="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg"
      >
        {{ t("ingredients.bulkImportParsed", { count: parsed.length }) }}
      </div>

      <div class="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          @click="$emit('close')"
        >
          {{ t("common.cancel") }}
        </button>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          :disabled="importing || parsed.length === 0"
          @click="handleImport"
        >
          {{ importing ? t("common.submitting") : t("common.import") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "@/i18n";
import type { CreateIngredientRequest } from "@makanmasak/shared-types";

const { t } = useI18n();

const emit = defineEmits<{
  close: [];
  import: [ingredients: CreateIngredientRequest[]];
}>();

const csvContent = ref("");
const parseError = ref("");
const parsed = ref<CreateIngredientRequest[]>([]);
const importing = ref(false);

watch(csvContent, (val) => {
  parseError.value = "";
  parsed.value = [];
  if (!val.trim()) return;

  try {
    const lines = val
      .trim()
      .split("\n")
      .filter((l) => l.trim());
    const results: CreateIngredientRequest[] = [];

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      if (cols.length < 2) {
        parseError.value = `Line ${i + 1}: at least name and unit are required`;
        return;
      }
      results.push({
        name: cols[0],
        unit: cols[1],
        category: cols[2] || undefined,
        costPerUnit: cols[3] ? Number(cols[3]) : undefined,
        supplier: cols[4] || undefined,
        minStockLevel: cols[5] ? Number(cols[5]) : undefined,
        currentStock: cols[6] ? Number(cols[6]) : undefined,
      });
    }

    parsed.value = results;
  } catch {
    parseError.value = t("ingredients.bulkImportParseError");
  }
});

function handleImport() {
  importing.value = true;
  emit("import", parsed.value);
}
</script>
