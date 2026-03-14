<template>
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <button
      class="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-700"
      @click="isOpen = !isOpen"
    >
      <span>{{ t("discovery.filters") }}</span>
      <svg
        class="w-4 h-4 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
    <div v-if="isOpen" class="px-4 pb-4 space-y-4 border-t border-gray-100">
      <div class="pt-3 flex flex-wrap gap-2">
        <button
          class="px-3 py-1.5 text-xs rounded-full border transition-colors"
          :class="
            filters.openNow
              ? 'bg-green-100 border-green-300 text-green-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          "
          @click="toggle('openNow')"
        >
          {{ t("discovery.openNow") }}
        </button>
        <button
          class="px-3 py-1.5 text-xs rounded-full border transition-colors"
          :class="
            filters.takeaway
              ? 'bg-blue-100 border-blue-300 text-blue-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          "
          @click="toggle('takeaway')"
        >
          {{ t("discovery.takeaway") }}
        </button>
        <button
          class="px-3 py-1.5 text-xs rounded-full border transition-colors"
          :class="
            filters.delivery
              ? 'bg-purple-100 border-purple-300 text-purple-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          "
          @click="toggle('delivery')"
        >
          {{ t("discovery.delivery") }}
        </button>
      </div>
      <div v-if="districts.length > 0">
        <label class="text-xs font-medium text-gray-500 mb-1 block">
          {{ t("discovery.district") }}
        </label>
        <select
          :value="filters.district || ''"
          class="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          @change="onDistrictChange"
        >
          <option value="">{{ t("discovery.allDistricts") }}</option>
          <option v-for="d in districts" :key="d" :value="d">{{ d }}</option>
        </select>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import type { SearchFilters } from "@/services/discoveryApi";

const { t } = useI18n();

const props = defineProps<{
  filters: SearchFilters;
  districts: string[];
}>();

const emit = defineEmits<{
  "update:filters": [filters: SearchFilters];
}>();

const isOpen = ref(false);

function toggle(key: "openNow" | "takeaway" | "delivery") {
  emit("update:filters", {
    ...props.filters,
    [key]: !props.filters[key],
  });
}

function onDistrictChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  emit("update:filters", {
    ...props.filters,
    district: target.value || undefined,
  });
}
</script>
