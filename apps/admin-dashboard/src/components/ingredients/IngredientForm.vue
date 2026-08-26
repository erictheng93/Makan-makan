<template>
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
      <h3 class="text-lg font-semibold mb-4">
        {{
          isEdit
            ? t("ingredients.editIngredient")
            : t("ingredients.addIngredient")
        }}
      </h3>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t("ingredients.name") }} *
            </label>
            <input
              v-model="form.name"
              type="text"
              required
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t("ingredients.unit") }} *
            </label>
            <input
              v-model="form.unit"
              type="text"
              required
              placeholder="kg, g, ml, 份"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t("ingredients.category") }}
            </label>
            <input
              v-model="form.category"
              type="text"
              placeholder="肉類、蔬菜、調味料"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t("ingredients.supplier") }}
            </label>
            <input
              v-model="form.supplier"
              type="text"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t("ingredients.costPerUnit") }}
            </label>
            <input
              v-model.number="form.costPerUnit"
              type="number"
              step="0.01"
              min="0"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t("ingredients.currentStock") }}
            </label>
            <input
              v-model.number="form.currentStock"
              type="number"
              step="0.01"
              min="0"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ t("ingredients.minStock") }}
            </label>
            <input
              v-model.number="form.minStockLevel"
              type="number"
              step="0.01"
              min="0"
              class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
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
            type="submit"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            :disabled="submitting"
          >
            {{ submitting ? t("common.submitting") : t("common.save") }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { useI18n } from "@/i18n";
import type {
  IngredientDefinitionResponse,
  CreateIngredientRequest,
  IngredientFormPayload,
} from "@makanmasak/shared-types";

const { t } = useI18n();

const props = defineProps<{
  ingredient?: IngredientDefinitionResponse;
}>();

const emit = defineEmits<{
  close: [];
  save: [data: IngredientFormPayload];
}>();

const isEdit = !!props.ingredient;
const submitting = ref(false);

// `|| undefined` treated a stored 0 as absent, so an ingredient at zero stock
// opened with a blank field -- precisely the case the owner is looking at.
// `?? undefined` keeps 0 and still maps null to "not set".
const form = reactive<CreateIngredientRequest>({
  name: props.ingredient?.name || "",
  unit: props.ingredient?.unit || "",
  category: props.ingredient?.category ?? undefined,
  costPerUnit: props.ingredient?.costPerUnit ?? undefined,
  supplier: props.ingredient?.supplier ?? undefined,
  minStockLevel: props.ingredient?.minStockLevel ?? undefined,
  currentStock: props.ingredient?.currentStock ?? undefined,
});

/**
 * Vue's `.number` modifier returns the raw string when the input is cleared,
 * so a blanked optional field went out as "" and the API rejected it. The
 * owner got "Validation failed" and no way to remove a cost or a minimum.
 *
 * The two schemas differ and the difference matters: updateIngredientSchema
 * is `.nullable().optional()` -- omitted leaves the column alone, explicit
 * null clears it -- while createIngredientSchema is only `.optional()` and
 * rejects null outright. So clearing maps to null when editing and to
 * undefined when creating.
 */
function optionalNumber(value: number | string | undefined) {
  if (value === "" || value === undefined || value === null) {
    return isEdit ? null : undefined;
  }
  return typeof value === "number" ? value : Number(value);
}

async function handleSubmit() {
  submitting.value = true;
  try {
    emit("save", {
      ...form,
      costPerUnit: optionalNumber(form.costPerUnit),
      minStockLevel: optionalNumber(form.minStockLevel),
      currentStock: optionalNumber(form.currentStock),
    });
  } finally {
    submitting.value = false;
  }
}
</script>
