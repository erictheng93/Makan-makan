<template>
  <div class="qr-mode-selector">
    <fieldset class="border-0 p-0 m-0">
      <legend class="block text-sm font-medium text-gray-700 mb-2">
        {{ t("qrMode.label") }} <span class="text-red-500">*</span>
      </legend>
      <p class="text-xs text-gray-500 mb-4">{{ t("qrMode.description") }}</p>

      <!-- 模式選擇 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <!-- 桌子模式 -->
        <label
          :class="[
            'mode-card block relative rounded-lg border-2 p-6 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
            modelValue === 'table'
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
              : 'border-gray-300 hover:border-blue-300',
          ]"
        >
          <input
            :checked="modelValue === 'table'"
            :aria-label="t('qrMode.tableMode')"
            class="sr-only"
            name="qr-mode"
            required
            type="radio"
            value="table"
            @change="selectMode('table')"
          />
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center">
              <div
                :class="[
                  'w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center',
                  modelValue === 'table'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300',
                ]"
              >
                <div
                  v-if="modelValue === 'table'"
                  class="w-2 h-2 bg-white rounded-full"
                />
              </div>
              <h3 class="text-lg font-semibold text-gray-900">
                {{ t("qrMode.tableMode") }}
              </h3>
            </div>
            <TableCellsIcon class="h-8 w-8 text-gray-400" />
          </div>

          <p class="text-sm text-gray-600 mb-4">
            {{ t("qrMode.tableModeDesc") }}
          </p>

          <!-- 桌子模式圖示 -->
          <div class="bg-white rounded-lg p-4 border border-gray-200">
            <div class="flex items-center justify-center">
              <div class="text-center">
                <div
                  class="w-24 h-24 mx-auto bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300"
                >
                  <QRCodeIcon class="h-12 w-12 text-gray-400" />
                </div>
                <p class="text-xs text-gray-500 mt-2">
                  {{ t("qrMode.oneTableOneCode") }}
                </p>
              </div>
            </div>
          </div>

          <div class="mt-4 space-y-2">
            <div class="flex items-center text-xs text-gray-600">
              <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
              {{ t("qrMode.tableAdvantage1") }}
            </div>
            <div class="flex items-center text-xs text-gray-600">
              <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
              {{ t("qrMode.tableAdvantage2") }}
            </div>
            <div class="flex items-center text-xs text-gray-600">
              <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
              {{ t("qrMode.tableAdvantage3") }}
            </div>
          </div>
        </label>

        <!-- 座位模式 -->
        <label
          :class="[
            'mode-card block relative rounded-lg border-2 p-6 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
            modelValue === 'seat'
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
              : 'border-gray-300 hover:border-blue-300',
          ]"
        >
          <input
            :checked="modelValue === 'seat'"
            :aria-label="t('qrMode.seatMode')"
            class="sr-only"
            name="qr-mode"
            required
            type="radio"
            value="seat"
            @change="selectMode('seat')"
          />
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center">
              <div
                :class="[
                  'w-5 h-5 rounded-full border-2 mr-3 flex items-center justify-center',
                  modelValue === 'seat'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300',
                ]"
              >
                <div
                  v-if="modelValue === 'seat'"
                  class="w-2 h-2 bg-white rounded-full"
                />
              </div>
              <h3 class="text-lg font-semibold text-gray-900">
                {{ t("qrMode.seatMode") }}
              </h3>
            </div>
            <UserGroupIcon class="h-8 w-8 text-gray-400" />
          </div>

          <p class="text-sm text-gray-600 mb-4">
            {{ t("qrMode.seatModeDesc") }}
          </p>

          <!-- 座位模式圖示 -->
          <div class="bg-white rounded-lg p-4 border border-gray-200">
            <div class="grid grid-cols-2 gap-2">
              <div
                v-for="i in 4"
                :key="i"
                class="w-full aspect-square bg-gray-100 rounded flex items-center justify-center border border-dashed border-gray-300"
              >
                <QRCodeIcon class="h-6 w-6 text-gray-400" />
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-2 text-center">
              {{ t("qrMode.oneSeatOneCode") }}
            </p>
          </div>

          <div class="mt-4 space-y-2">
            <div class="flex items-center text-xs text-gray-600">
              <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
              {{ t("qrMode.seatAdvantage1") }}
            </div>
            <div class="flex items-center text-xs text-gray-600">
              <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
              {{ t("qrMode.seatAdvantage2") }}
            </div>
            <div class="flex items-center text-xs text-gray-600">
              <CheckIcon class="h-4 w-4 text-green-500 mr-2" />
              {{ t("qrMode.seatAdvantage3") }}
            </div>
          </div>
        </label>
      </div>
    </fieldset>

    <!-- 座位模式配置 -->
    <div
      v-if="modelValue === 'seat'"
      class="bg-gray-50 rounded-lg p-6 border border-gray-200"
    >
      <h4 class="text-sm font-semibold text-gray-900 mb-4">
        {{ t("qrMode.seatConfig") }}
      </h4>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {{ t("qrMode.seatCount") }} <span class="text-red-500">*</span>
          </label>
          <input
            :value="seatConfig.count"
            type="number"
            min="1"
            :max="maxSeatCount"
            :readonly="seatCountReadOnly"
            :aria-describedby="
              seatCountReadOnly ? 'seat-count-read-only-help' : undefined
            "
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            @input="updateSeatCount"
          />
          <p
            v-if="seatCountReadOnly"
            id="seat-count-read-only-help"
            class="text-xs text-amber-700 mt-1"
          >
            {{ t("qrMode.seatCountManaged") }}
          </p>
          <p v-else class="text-xs text-gray-500 mt-1">
            {{ t("qrMode.willCreate", { count: seatConfig.count }) }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            {{ t("qrMode.numberingStyle") }} <span class="text-red-500">*</span>
          </label>
          <select
            :value="seatConfig.numberingStyle"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            @change="updateNumberingStyle"
          >
            <option value="numeric">{{ t("qrMode.numeric") }}</option>
            <option value="alphabetic">{{ t("qrMode.alphabetic") }}</option>
          </select>
        </div>
      </div>

      <!-- 預覽 -->
      <div class="mt-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          {{ t("qrMode.seatNumberPreview") }}
        </label>
        <div class="bg-white rounded-lg p-4 border border-gray-200">
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(number, index) in previewNumbers"
              :key="index"
              class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
            >
              {{ number }}
            </span>
            <span
              v-if="seatConfig.count > 10"
              class="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
            >
              {{ t("qrMode.totalCount", { count: seatConfig.count }) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 提示資訊 -->
    <div class="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div class="flex">
        <ExclamationTriangleIcon
          class="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5"
        />
        <div class="text-sm text-yellow-800">
          <p class="font-medium mb-1">{{ t("qrMode.notice") }}</p>
          <ul class="list-disc list-inside space-y-1 text-xs">
            <li>{{ t("qrMode.noticeItem1") }}</li>
            <li>{{ t("qrMode.noticeItem2") }}</li>
            <li>{{ t("qrMode.noticeItem3") }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/i18n";
import {
  TableCellsIcon,
  UserGroupIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/vue/24/outline";
import QRCodeIcon from "@heroicons/vue/24/outline/QrCodeIcon";

const { t } = useI18n();

interface SeatConfig {
  count: number;
  numberingStyle: "numeric" | "alphabetic";
}

interface Props {
  modelValue: "table" | "seat";
  seatConfig: SeatConfig;
  maxSeatCount?: number;
  seatCountReadOnly?: boolean;
}

interface Emits {
  (e: "update:modelValue", value: "table" | "seat"): void;
  (e: "update:seatConfig", value: SeatConfig): void;
}

const props = withDefaults(defineProps<Props>(), {
  maxSeatCount: 100,
  seatCountReadOnly: false,
});
const emit = defineEmits<Emits>();

// 選擇模式
const selectMode = (mode: "table" | "seat") => {
  emit("update:modelValue", mode);
};

// 更新座位數量
const updateSeatCount = (event: Event) => {
  if (props.seatCountReadOnly) return;
  const target = event.target as HTMLInputElement;
  const count = Math.min(parseInt(target.value) || 1, props.maxSeatCount);
  emit("update:seatConfig", {
    ...props.seatConfig,
    count,
  });
};

// 更新編號風格
const updateNumberingStyle = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const numberingStyle = target.value as "numeric" | "alphabetic";
  emit("update:seatConfig", {
    ...props.seatConfig,
    numberingStyle,
  });
};

// 生成座位編號預覽
const previewNumbers = computed(() => {
  const { count, numberingStyle } = props.seatConfig;
  const previewCount = Math.min(count, 10);
  const numbers: string[] = [];

  for (let i = 0; i < previewCount; i++) {
    if (numberingStyle === "numeric") {
      numbers.push(String(i + 1).padStart(2, "0"));
    } else if (numberingStyle === "alphabetic") {
      const letter = String.fromCharCode(65 + (i % 26));
      const repeat = Math.floor(i / 26) + 1;
      numbers.push(letter.repeat(repeat));
    }
  }

  return numbers;
});
</script>

<style scoped>
.mode-card {
  min-height: 380px;
}
</style>
