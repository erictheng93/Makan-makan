<template>
  <div class="ingredients-view">
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          {{ t("ingredients.title") }}
        </h1>
        <p class="text-gray-600">{{ t("ingredients.subtitle") }}</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          @click="showBulkImport = true"
        >
          {{ t("common.import") }}
        </button>
        <button
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          @click="showForm = true"
        >
          {{ t("ingredients.addIngredient") }}
        </button>
      </div>
    </div>

    <!-- Search & Filter -->
    <div class="flex gap-4 mb-6">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="t('common.search')"
        class="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        @input="debouncedLoad"
      />
      <select
        v-model="categoryFilter"
        class="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        @change="loadIngredients"
      >
        <option value="">{{ t("ingredients.allCategories") }}</option>
        <option v-for="cat in categories" :key="cat" :value="cat">
          {{ cat }}
        </option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-16">
      <div
        class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"
      ></div>
    </div>

    <!-- Table -->
    <IngredientTable
      v-else
      :items="ingredients"
      @edit="editIngredient"
      @delete="confirmDelete"
    />

    <!-- Pagination -->
    <div v-if="total > limit" class="flex justify-center mt-6 gap-2">
      <button
        :disabled="page <= 1"
        class="px-3 py-1 border rounded text-sm disabled:opacity-50"
        @click="
          page--;
          loadIngredients();
        "
      >
        {{ t("common.previous") }}
      </button>
      <span class="px-3 py-1 text-sm text-gray-600">
        {{ page }} / {{ Math.ceil(total / limit) }}
      </span>
      <button
        :disabled="page >= Math.ceil(total / limit)"
        class="px-3 py-1 border rounded text-sm disabled:opacity-50"
        @click="
          page++;
          loadIngredients();
        "
      >
        {{ t("common.next") }}
      </button>
    </div>

    <!-- Add/Edit Form Modal -->
    <IngredientForm
      v-if="showForm"
      :ingredient="editingIngredient"
      @close="closeForm"
      @save="handleSave"
    />

    <!-- Bulk Import Modal -->
    <BulkImportDialog
      v-if="showBulkImport"
      @close="showBulkImport = false"
      @import="handleBulkImport"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { ingredientApi } from "@/services/ingredientApi";
import { useConfirmModal } from "@/composables/useConfirmModal";
import IngredientTable from "@/components/ingredients/IngredientTable.vue";
import IngredientForm from "@/components/ingredients/IngredientForm.vue";
import BulkImportDialog from "@/components/ingredients/BulkImportDialog.vue";
import type {
  IngredientDefinitionResponse,
  CreateIngredientRequest,
} from "@makanmasak/shared-types";

const { t } = useI18n();
const { confirm: confirmModal } = useConfirmModal();
const authStore = useAuthStore();
const restaurantId = computed(() => authStore.restaurantId || "");

const loading = ref(false);
const ingredients = ref<IngredientDefinitionResponse[]>([]);
const categories = ref<string[]>([]);
const total = ref(0);
const page = ref(1);
const limit = 50;
const searchQuery = ref("");
const categoryFilter = ref("");
const showForm = ref(false);
const showBulkImport = ref(false);
const editingIngredient = ref<IngredientDefinitionResponse | undefined>();

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedLoad() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    page.value = 1;
    loadIngredients();
  }, 300);
}

async function loadIngredients() {
  if (!restaurantId.value) return;
  loading.value = true;
  try {
    const result = await ingredientApi.list(restaurantId.value, {
      page: page.value,
      limit,
      search: searchQuery.value || undefined,
      category: categoryFilter.value || undefined,
    });
    ingredients.value = result.items;
    total.value = result.total;
  } catch (error) {
    console.error("Failed to load ingredients:", error);
  } finally {
    loading.value = false;
  }
}

async function loadCategories() {
  if (!restaurantId.value) return;
  try {
    categories.value = await ingredientApi.getCategories(restaurantId.value);
  } catch (error) {
    console.error("Failed to load categories:", error);
  }
}

function editIngredient(item: IngredientDefinitionResponse) {
  editingIngredient.value = item;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingIngredient.value = undefined;
}

async function handleSave(data: CreateIngredientRequest) {
  if (!restaurantId.value) return;
  try {
    if (editingIngredient.value) {
      await ingredientApi.update(
        restaurantId.value,
        editingIngredient.value.id,
        data,
      );
    } else {
      await ingredientApi.create(restaurantId.value, data);
    }
    closeForm();
    await loadIngredients();
    await loadCategories();
  } catch (error) {
    console.error("Failed to save ingredient:", error);
  }
}

async function confirmDelete(item: IngredientDefinitionResponse) {
  const confirmed = await confirmModal({
    type: "danger",
    title: t("common.delete"),
    message: t("ingredients.confirmDelete", { name: item.name }),
    confirmLabel: t("common.delete"),
  });
  if (!confirmed) return;
  try {
    await ingredientApi.remove(restaurantId.value, item.id);
    await loadIngredients();
  } catch (error) {
    console.error("Failed to delete ingredient:", error);
  }
}

async function handleBulkImport(items: CreateIngredientRequest[]) {
  if (!restaurantId.value) return;
  try {
    await ingredientApi.bulkImport(restaurantId.value, items);
    showBulkImport.value = false;
    await loadIngredients();
    await loadCategories();
  } catch (error) {
    console.error("Failed to bulk import:", error);
  }
}

onMounted(() => {
  loadIngredients();
  loadCategories();
});
</script>
