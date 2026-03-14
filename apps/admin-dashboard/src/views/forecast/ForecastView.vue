<template>
  <div class="forecast-view">
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          {{ t("forecast.title") }}
        </h1>
        <p class="text-gray-600">{{ t("forecast.subtitle") }}</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          :disabled="loading"
          @click="loadForecast"
        >
          <ArrowPathIcon class="h-4 w-4 mr-2" />
          {{ t("common.refresh") }}
        </button>
        <button
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          :disabled="generating"
          @click="generateForecast"
        >
          <span v-if="generating" class="animate-spin mr-2">⏳</span>
          {{ t("forecast.generate") }}
        </button>
      </div>
    </div>

    <!-- Stale data warning -->
    <div
      v-if="isStale"
      class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800"
    >
      ⚠️ {{ t("forecast.staleWarning") }}
    </div>

    <!-- Date Picker -->
    <div class="mb-6">
      <ForecastDatePicker
        :start-date="startDate"
        :end-date="endDate"
        @update:start-date="startDate = $event"
        @update:end-date="endDate = $event"
      />
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="flex gap-6">
        <button
          class="pb-3 text-sm font-medium border-b-2 transition-colors"
          :class="
            activeTab === 'forecast'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          "
          @click="activeTab = 'forecast'"
        >
          {{ t("forecast.forecastTab") }}
        </button>
        <button
          class="pb-3 text-sm font-medium border-b-2 transition-colors"
          :class="
            activeTab === 'accuracy'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          "
          @click="
            activeTab = 'accuracy';
            loadAccuracy();
          "
        >
          {{ t("forecast.accuracyTab") }}
        </button>
      </nav>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-16">
      <div
        class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"
      ></div>
    </div>

    <!-- Forecast Tab -->
    <template v-else-if="activeTab === 'forecast'">
      <ForecastAlerts :alerts="alerts" class="mb-6" />
      <ForecastTable :items="forecastItems" />
    </template>

    <!-- Accuracy Tab -->
    <template v-else-if="activeTab === 'accuracy'">
      <ForecastAccuracyTab :items="accuracyItems" :loading="accuracyLoading" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowPathIcon } from "@heroicons/vue/24/outline";
import { forecastApi } from "@/services/forecastApi";
import { useAuthStore } from "@/stores/auth";
import ForecastDatePicker from "@/components/forecast/ForecastDatePicker.vue";
import ForecastTable from "@/components/forecast/ForecastTable.vue";
import ForecastAlerts from "@/components/forecast/ForecastAlerts.vue";
import ForecastAccuracyTab from "@/components/forecast/ForecastAccuracyTab.vue";
import type {
  ForecastItemResult,
  ForecastAccuracyItem,
  ForecastAlert,
} from "@makanmakan/shared-types";

const { t } = useI18n();
const authStore = useAuthStore();

const loading = ref(false);
const generating = ref(false);
const accuracyLoading = ref(false);
const isStale = ref(false);
const activeTab = ref<"forecast" | "accuracy">("forecast");

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const startDate = ref(tomorrow.toISOString().split("T")[0]);
const endDate = ref(tomorrow.toISOString().split("T")[0]);

const forecastItems = ref<ForecastItemResult[]>([]);
const alerts = ref<ForecastAlert[]>([]);
const accuracyItems = ref<ForecastAccuracyItem[]>([]);

const restaurantId = computed(() => authStore.restaurantId || "");

async function loadForecast() {
  if (!restaurantId.value) return;
  loading.value = true;
  try {
    const forecasts = await forecastApi.getForecast(restaurantId.value, {
      startDate: startDate.value,
      endDate: endDate.value,
    });
    forecastItems.value = forecasts.flatMap((f) => f.items);
    isStale.value = forecasts.some((f) => f.stale);

    const alertsData = await forecastApi.getAlerts(restaurantId.value);
    alerts.value = alertsData;
  } catch (error) {
    console.error("Failed to load forecast:", error);
  } finally {
    loading.value = false;
  }
}

async function generateForecast() {
  if (!restaurantId.value) return;
  generating.value = true;
  try {
    await forecastApi.generate(restaurantId.value, {
      startDate: startDate.value,
      endDate: endDate.value,
    });
    await loadForecast();
  } catch (error) {
    console.error("Failed to generate forecast:", error);
  } finally {
    generating.value = false;
  }
}

async function loadAccuracy() {
  if (!restaurantId.value) return;
  accuracyLoading.value = true;
  try {
    // Load accuracy for past 7 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    accuracyItems.value = await forecastApi.getAccuracy(restaurantId.value, {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("Failed to load accuracy:", error);
  } finally {
    accuracyLoading.value = false;
  }
}

watch([startDate, endDate], () => {
  if (activeTab.value === "forecast") loadForecast();
});

onMounted(() => loadForecast());
</script>
