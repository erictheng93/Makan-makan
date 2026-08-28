<template>
  <div class="flex items-center gap-3">
    <div class="flex rounded-lg border border-gray-300 overflow-hidden">
      <button
        v-for="preset in presets"
        :key="preset.key"
        class="px-4 py-2 text-sm font-medium transition-colors"
        :class="
          selectedPreset === preset.key
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        "
        @click="selectPreset(preset.key)"
      >
        {{ preset.label }}
      </button>
    </div>
    <div v-if="selectedPreset === 'custom'" class="flex items-center gap-2">
      <input
        type="date"
        :value="startDate"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        @input="
          $emit('update:startDate', ($event.target as HTMLInputElement).value)
        "
      />
      <span class="text-gray-500">~</span>
      <input
        type="date"
        :value="endDate"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        @input="
          $emit('update:endDate', ($event.target as HTMLInputElement).value)
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "@/i18n";

defineProps<{
  startDate: string;
  endDate: string;
}>();

const emit = defineEmits<{
  "update:startDate": [value: string];
  "update:endDate": [value: string];
}>();

const selectedPreset = ref("tomorrow");
const { t } = useI18n();

const presets = computed(() => [
  { key: "tomorrow", label: t("forecast.tomorrow") },
  { key: "week", label: t("forecast.nextSevenDays") },
  { key: "custom", label: t("forecast.customRange") },
]);

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function selectPreset(key: string) {
  selectedPreset.value = key;
  const today = new Date();
  if (key === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    emit("update:startDate", formatDate(tomorrow));
    emit("update:endDate", formatDate(tomorrow));
  } else if (key === "week") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfWeek = new Date(tomorrow);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    emit("update:startDate", formatDate(tomorrow));
    emit("update:endDate", formatDate(endOfWeek));
  }
}
</script>
