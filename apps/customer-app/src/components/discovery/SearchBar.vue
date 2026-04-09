<template>
  <div class="relative">
    <div class="relative">
      <input
        v-model="query"
        type="text"
        :placeholder="t('discovery.searchPlaceholder')"
        class="w-full pl-10 pr-10 py-3 rounded-xl bg-ios-card focus:ring-2 focus:ring-ios-blue/30 focus:bg-white transition-all text-ios-text shadow-[0_2px_8px_rgb(0,0,0,0.04)]"
        @input="onInput"
        @keyup.enter="onSearch"
      />
      <svg
        class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <button
        v-if="query"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        @click="clearQuery"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
    <div v-if="keywords.length > 0 && !query" class="mt-3 flex flex-wrap gap-2">
      <button
        v-for="keyword in keywords"
        :key="keyword"
        class="px-3 py-1.5 text-sm bg-ios-card hover:bg-ios-blue/10 text-ios-text hover:text-ios-blue rounded-full transition-colors"
        @click="selectKeyword(keyword)"
      >
        {{ keyword }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  modelValue: string;
  keywords: string[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  search: [query: string];
  clear: [];
}>();

const query = ref(props.modelValue);

let debounceTimer: ReturnType<typeof setTimeout>;

watch(
  () => props.modelValue,
  (val) => {
    query.value = val;
  },
);

function onInput() {
  emit("update:modelValue", query.value);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (query.value.length >= 1) {
      emit("search", query.value);
    }
  }, 300);
}

function onSearch() {
  if (query.value) {
    emit("search", query.value);
  }
}

function selectKeyword(keyword: string) {
  query.value = keyword;
  emit("update:modelValue", keyword);
  emit("search", keyword);
}

function clearQuery() {
  query.value = "";
  emit("update:modelValue", "");
  emit("clear");
}
</script>
