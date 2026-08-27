<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
      <div class="flex items-center justify-between mb-1">
        <h3 class="text-lg font-semibold text-[#1C1C1E]">
          {{ t("ingredients.adjustStock") }}
        </h3>
        <button
          class="text-gray-400 hover:text-gray-600"
          @click="$emit('close')"
        >
          ✕
        </button>
      </div>
      <p class="text-sm text-gray-500 mb-5">
        {{ ingredient.name }} ·
        {{ t("ingredients.currentStock") }}
        {{ ingredient.currentStock ?? 0 }} {{ ingredient.unit }}
      </p>

      <form class="space-y-4" @submit.prevent="submit">
        <div>
          <span class="block text-[13px] font-semibold text-[#1C1C1E] mb-1.5">
            {{ t("ingredients.movementDirection") }}
          </span>
          <div class="flex gap-2">
            <button
              v-for="option in directions"
              :key="option.value"
              type="button"
              :data-testid="`direction-${option.value}`"
              class="flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors"
              :class="
                direction === option.value
                  ? 'bg-[#007AFF] text-white'
                  : 'bg-[#F2F2F7] text-[#1C1C1E] hover:bg-[#E5E5EA]'
              "
              @click="direction = option.value"
            >
              {{ t(option.labelKey) }}
            </button>
          </div>
        </div>

        <label class="block text-[13px] font-semibold text-[#1C1C1E]">
          {{ t("ingredients.movementQuantity") }}
          <div class="mt-1.5 flex items-center gap-2">
            <input
              v-model.number="quantity"
              type="number"
              step="0.01"
              min="0"
              required
              data-testid="movement-quantity"
              class="flex-1 rounded-xl bg-[#F2F2F7] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#007AFF]/30"
            />
            <span class="text-sm text-gray-500">{{ ingredient.unit }}</span>
          </div>
        </label>

        <label class="block text-[13px] font-semibold text-[#1C1C1E]">
          {{ t("ingredients.movementReason") }}
          <select
            v-model="reason"
            data-testid="movement-reason"
            class="mt-1.5 w-full rounded-xl bg-[#F2F2F7] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#007AFF]/30"
          >
            <option
              v-for="value in reasonsForDirection"
              :key="value"
              :value="value"
            >
              {{ t(`ingredients.movementReasons.${value}`) }}
            </option>
          </select>
        </label>

        <label class="block text-[13px] font-semibold text-[#1C1C1E]">
          {{ t("ingredients.movementNote") }}
          <input
            v-model="note"
            type="text"
            maxlength="500"
            data-testid="movement-note"
            class="mt-1.5 w-full rounded-xl bg-[#F2F2F7] px-4 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-[#007AFF]/30"
          />
        </label>

        <!-- The resulting balance, so the owner is not doing the arithmetic in
             their head before committing to a write. -->
        <p class="text-sm text-gray-600" data-testid="movement-preview">
          {{ t("ingredients.movementResult") }}
          <span
            class="font-semibold"
            :class="resultsNegative ? 'text-ios-error' : 'text-[#1C1C1E]'"
          >
            {{ resultingStock }} {{ ingredient.unit }}
          </span>
        </p>
        <p
          v-if="resultsNegative"
          class="text-xs text-ios-error"
          role="alert"
          data-testid="movement-negative-warning"
        >
          {{ t("ingredients.movementNegativeWarning") }}
        </p>

        <p v-if="error" class="text-sm text-ios-error" role="alert">
          {{ error }}
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="px-5 py-2.5 text-[14px] font-semibold text-[#1C1C1E] bg-[#F2F2F7] rounded-full hover:bg-[#E5E5EA]"
            @click="$emit('close')"
          >
            {{ t("common.cancel") }}
          </button>
          <button
            type="submit"
            :disabled="submitting || !quantity"
            data-testid="movement-submit"
            class="px-5 py-2.5 text-[14px] font-semibold text-white bg-[#007AFF] rounded-full hover:bg-[#0066D6] disabled:opacity-50"
          >
            {{ submitting ? t("common.submitting") : t("common.confirm") }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "@/i18n";
import type {
  IngredientDefinitionResponse,
  ManualStockMovementReason,
} from "@makanmasak/shared-types";

const { t } = useI18n();

const props = defineProps<{
  ingredient: IngredientDefinitionResponse;
  submitting?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  close: [];
  submit: [
    input: {
      delta: number;
      reason: ManualStockMovementReason;
      note: string | null;
    },
  ];
}>();

/**
 * Direction and quantity are separate inputs because a signed number is a
 * poor thing to ask an owner for — "-2" is easy to mistype as "2". The signed
 * delta the API wants is derived on submit.
 */
const directions = [
  { value: "in" as const, labelKey: "ingredients.movementIn" },
  { value: "out" as const, labelKey: "ingredients.movementOut" },
];

const direction = ref<"in" | "out">("in");
const quantity = ref<number | undefined>();
const note = ref("");

/** Receiving stock is never waste; writing it off is never a purchase. */
const reasonsForDirection = computed<ManualStockMovementReason[]>(() =>
  direction.value === "in"
    ? ["purchase", "correction", "transfer"]
    : ["waste", "correction", "transfer"],
);

const reason = ref<ManualStockMovementReason>("purchase");

// Flipping direction changes the offered reasons, so a stale selection would
// leave the select showing nothing that matches. Snap it to a valid one the
// moment the direction changes rather than only at submit.
watch(reasonsForDirection, (options) => {
  if (!options.includes(reason.value)) reason.value = options[0];
});

const signedDelta = computed(() => {
  const amount = Number(quantity.value) || 0;
  return direction.value === "in" ? amount : -amount;
});

const resultingStock = computed(
  () => (props.ingredient.currentStock ?? 0) + signedDelta.value,
);

const resultsNegative = computed(() => resultingStock.value < 0);

function submit() {
  if (!signedDelta.value) return;
  emit("submit", {
    delta: signedDelta.value,
    reason: reason.value,
    note: note.value.trim() || null,
  });
}
</script>
