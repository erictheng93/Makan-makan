<template>
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div
      class="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto"
    >
      <h3 class="text-lg font-semibold mb-4">
        {{ t("ingredients.editRecipe") }}: {{ menuItemName }}
      </h3>

      <!-- Ingredient search & add -->
      <div class="mb-4">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          {{ t("ingredients.addIngredientToRecipe") }}
        </label>
        <div class="flex gap-2">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('ingredients.searchIngredient')"
            class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            @input="searchIngredients"
          />
        </div>
        <!-- Search results dropdown -->
        <div
          v-if="searchResults.length > 0"
          class="mt-1 border border-gray-200 rounded-lg shadow-sm max-h-40 overflow-y-auto"
        >
          <button
            v-for="ing in searchResults"
            :key="ing.id"
            class="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-b-0"
            @click="addIngredient(ing)"
          >
            {{ ing.name }} ({{ ing.unit }})
            <span v-if="ing.category" class="text-gray-400 ml-1"
              >- {{ ing.category }}</span
            >
          </button>
        </div>
      </div>

      <!-- Current recipe entries -->
      <div class="space-y-3">
        <div
          v-for="(entry, index) in entries"
          :key="entry.ingredientId"
          class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
        >
          <div class="flex-1">
            <span class="text-sm font-medium">{{ entry.ingredientName }}</span>
          </div>
          <div class="w-24">
            <input
              v-model.number="entry.quantityPerServing"
              type="number"
              step="0.01"
              min="0.01"
              class="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              :placeholder="t('ingredients.quantity')"
            />
          </div>
          <div class="w-20">
            <input
              v-model="entry.unit"
              type="text"
              class="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              :placeholder="t('ingredients.unit')"
            />
          </div>
          <label class="flex items-center gap-1 text-xs text-gray-500">
            <input v-model="entry.isOptional" type="checkbox" class="rounded" />
            {{ t("ingredients.optional") }}
          </label>
          <button
            class="text-red-500 hover:text-red-700"
            @click="removeEntry(index)"
          >
            &times;
          </button>
        </div>
      </div>

      <div
        v-if="entries.length === 0"
        class="text-center py-6 text-gray-400 text-sm"
      >
        {{ t("ingredients.noRecipeEntries") }}
      </div>

      <div class="flex justify-end gap-3 pt-4 mt-4 border-t">
        <button
          type="button"
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          @click="$emit('close')"
        >
          {{ t("common.cancel") }}
        </button>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          :disabled="saving"
          @click="handleSave"
        >
          {{ saving ? t("common.submitting") : t("common.save") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "@/i18n";
import type {
  IngredientDefinitionResponse,
  RecipeEntryResponse,
} from "@makanmakan/shared-types";

const { t } = useI18n();

const props = defineProps<{
  menuItemId: number;
  menuItemName: string;
  initialEntries: RecipeEntryResponse[];
  availableIngredients: IngredientDefinitionResponse[];
}>();

const emit = defineEmits<{
  close: [];
  save: [
    entries: {
      ingredientId: number;
      quantityPerServing: number;
      unit: string;
      isOptional: boolean;
    }[],
  ];
}>();

const saving = ref(false);
const searchQuery = ref("");
const searchResults = ref<IngredientDefinitionResponse[]>([]);

const entries = ref(
  props.initialEntries.map((e) => ({
    ingredientId: e.ingredientId,
    ingredientName: e.ingredientName,
    quantityPerServing: e.quantityPerServing,
    unit: e.unit,
    isOptional: e.isOptional,
  })),
);

function searchIngredients() {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  const query = searchQuery.value.toLowerCase();
  const existingIds = new Set(entries.value.map((e) => e.ingredientId));
  searchResults.value = props.availableIngredients
    .filter(
      (ing) =>
        !existingIds.has(ing.id) &&
        (ing.name.toLowerCase().includes(query) ||
          (ing.category && ing.category.toLowerCase().includes(query))),
    )
    .slice(0, 10);
}

function addIngredient(ing: IngredientDefinitionResponse) {
  entries.value.push({
    ingredientId: ing.id,
    ingredientName: ing.name,
    quantityPerServing: 0,
    unit: ing.unit,
    isOptional: false,
  });
  searchQuery.value = "";
  searchResults.value = [];
}

function removeEntry(index: number) {
  entries.value.splice(index, 1);
}

async function handleSave() {
  saving.value = true;
  try {
    emit(
      "save",
      entries.value.map((e) => ({
        ingredientId: e.ingredientId,
        quantityPerServing: e.quantityPerServing,
        unit: e.unit,
        isOptional: e.isOptional,
      })),
    );
  } finally {
    saving.value = false;
  }
}
</script>
