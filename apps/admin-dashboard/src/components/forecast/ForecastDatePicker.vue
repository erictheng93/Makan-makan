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
import { ref } from "vue";

defineProps<{
  startDate: string;
  endDate: string;
}>();

const emit = defineEmits<{
  "update:startDate": [value: string];
  "update:endDate": [value: string];
}>();

const selectedPreset = ref("tomorrow");

const presets = [
  { key: "tomorrow", label: "明日" },
  { key: "week", label: "本週" },
  { key: "custom", label: "自訂" },
];

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
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
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    emit("update:startDate", formatDate(tomorrow));
    emit("update:endDate", formatDate(endOfWeek));
  }
}
</script>
