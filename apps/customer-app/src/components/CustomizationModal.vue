<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50"
    @click.self="$emit('close')"
  >
    <div
      class="bg-white rounded-t-3xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden"
      @click.stop
    >
      <!-- 頂部把手和標題 -->
      <div class="px-6 py-4 border-b border-gray-200">
        <div class="flex justify-center mb-3">
          <div class="w-8 h-1 bg-gray-300 rounded-full" />
        </div>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">選擇規格</h3>
          <button
            class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            @click="$emit('close')"
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
      </div>

      <div class="overflow-y-auto flex-1">
        <div class="p-6 space-y-6">
          <!-- 尺寸選擇 -->
          <div v-if="item?.options?.sizes?.length">
            <h4 class="text-base font-medium text-gray-900 mb-3">
              尺寸 <span class="text-red-500">*</span>
            </h4>
            <div class="space-y-2">
              <label
                v-for="size in item.options.sizes"
                :key="size.id"
                class="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors"
                :class="{
                  'border-indigo-500 bg-indigo-50':
                    selectedSize?.id === size.id,
                  'hover:border-gray-300': selectedSize?.id !== size.id,
                }"
              >
                <div class="flex items-center">
                  <input
                    v-model="selectedSizeId"
                    type="radio"
                    :value="size.id"
                    class="sr-only"
                  />
                  <div class="flex items-center">
                    <div
                      class="w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3"
                      :class="{
                        'border-indigo-500 bg-indigo-500':
                          selectedSize?.id === size.id,
                        'border-gray-300': selectedSize?.id !== size.id,
                      }"
                    >
                      <div
                        v-if="selectedSize?.id === size.id"
                        class="w-2 h-2 rounded-full bg-white"
                      />
                    </div>
                    <div>
                      <div class="font-medium text-gray-900">
                        {{ size.name }}
                      </div>
                      <div
                        v-if="size.description"
                        class="text-sm text-gray-600"
                      >
                        {{ size.description }}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="text-sm font-medium text-gray-900">
                  <span
                    v-if="(size.priceAdjustment || size.priceModifier || 0) > 0"
                    >+${{
                      formatPrice(
                        size.priceAdjustment || size.priceModifier || 0,
                      )
                    }}</span
                  >
                  <span
                    v-else-if="
                      (size.priceAdjustment || size.priceModifier || 0) < 0
                    "
                    >-${{
                      formatPrice(
                        Math.abs(
                          size.priceAdjustment || size.priceModifier || 0,
                        ),
                      )
                    }}</span
                  >
                </div>
              </label>
            </div>
          </div>

          <!-- 客製化選項 -->
          <div v-if="item?.options?.customizations?.length">
            <h4 class="text-base font-medium text-gray-900 mb-3">客製化選項</h4>
            <div class="space-y-3">
              <div
                v-for="option in item.options.customizations"
                :key="option.id"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="font-medium text-gray-900">{{
                    option.name
                  }}</span>
                  <span v-if="option.required" class="text-xs text-red-500"
                    >必選</span
                  >
                </div>

                <!-- 單選選項 -->
                <div v-if="option.type === 'single'" class="space-y-2">
                  <label
                    v-for="choice in option.choices"
                    :key="choice.id"
                    class="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors"
                    :class="{
                      'border-indigo-500 bg-indigo-50':
                        selectedOptions[getOptionKey(option)] ===
                        getChoiceKey(choice),
                      'hover:border-gray-300':
                        selectedOptions[getOptionKey(option)] !==
                        getChoiceKey(choice),
                    }"
                  >
                    <div class="flex items-center">
                      <input
                        v-model="selectedOptions[getOptionKey(option)]"
                        type="radio"
                        :value="choice.id"
                        class="sr-only"
                      />
                      <div
                        class="w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3"
                        :class="{
                          'border-indigo-500 bg-indigo-500':
                            selectedOptions[getOptionKey(option)] ===
                            getChoiceKey(choice),
                          'border-gray-300':
                            selectedOptions[getOptionKey(option)] !==
                            getChoiceKey(choice),
                        }"
                      >
                        <div
                          v-if="
                            selectedOptions[getOptionKey(option)] ===
                            getChoiceKey(choice)
                          "
                          class="w-2 h-2 rounded-full bg-white"
                        />
                      </div>
                      <span class="text-gray-900">{{ choice.name }}</span>
                    </div>
                    <span
                      v-if="
                        (choice.priceAdjustment || choice.priceModifier || 0) >
                        0
                      "
                      class="text-sm font-medium text-gray-900"
                    >
                      +${{
                        formatPrice(
                          choice.priceAdjustment || choice.priceModifier || 0,
                        )
                      }}
                    </span>
                  </label>
                </div>

                <!-- 多選選項 -->
                <div v-else-if="option.type === 'multiple'" class="space-y-2">
                  <label
                    v-for="choice in option.choices"
                    :key="choice.id"
                    class="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors"
                    :class="{
                      'border-indigo-500 bg-indigo-50': selectedMultipleOptions[
                        getOptionKey(option)
                      ]?.includes(getChoiceKey(choice)),
                      'hover:border-gray-300': !selectedMultipleOptions[
                        getOptionKey(option)
                      ]?.includes(getChoiceKey(choice)),
                    }"
                  >
                    <div class="flex items-center">
                      <input
                        v-model="selectedMultipleOptions[getOptionKey(option)]"
                        type="checkbox"
                        :value="choice.id"
                        class="sr-only"
                      />
                      <div
                        class="w-4 h-4 rounded border-2 flex items-center justify-center mr-3"
                        :class="{
                          'border-indigo-500 bg-indigo-500':
                            selectedMultipleOptions[
                              getOptionKey(option)
                            ]?.includes(getChoiceKey(choice)),
                          'border-gray-300': !selectedMultipleOptions[
                            getOptionKey(option)
                          ]?.includes(getChoiceKey(choice)),
                        }"
                      >
                        <svg
                          v-if="
                            selectedMultipleOptions[
                              getOptionKey(option)
                            ]?.includes(getChoiceKey(choice))
                          "
                          class="w-3 h-3 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      </div>
                      <span class="text-gray-900">{{ choice.name }}</span>
                    </div>
                    <span
                      v-if="
                        (choice.priceAdjustment || choice.priceModifier || 0) >
                        0
                      "
                      class="text-sm font-medium text-gray-900"
                    >
                      +${{
                        formatPrice(
                          choice.priceAdjustment || choice.priceModifier || 0,
                        )
                      }}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- 加購項目 -->
          <div v-if="item?.options?.addOns?.length">
            <h4 class="text-base font-medium text-gray-900 mb-3">加購項目</h4>
            <div class="space-y-2">
              <label
                v-for="addOn in item.options.addOns"
                :key="addOn.id"
                class="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer transition-colors"
                :class="{
                  'border-indigo-500 bg-indigo-50': selectedAddOns.includes(
                    getAddOnKey(addOn),
                  ),
                  'hover:border-gray-300': !selectedAddOns.includes(
                    getAddOnKey(addOn),
                  ),
                }"
              >
                <div class="flex items-center">
                  <input
                    v-model="selectedAddOns"
                    type="checkbox"
                    :value="getAddOnKey(addOn)"
                    class="sr-only"
                  />
                  <div
                    class="w-4 h-4 rounded border-2 flex items-center justify-center mr-3"
                    :class="{
                      'border-indigo-500 bg-indigo-500':
                        selectedAddOns.includes(getAddOnKey(addOn)),
                      'border-gray-300': !selectedAddOns.includes(
                        getAddOnKey(addOn),
                      ),
                    }"
                  >
                    <svg
                      v-if="selectedAddOns.includes(getAddOnKey(addOn))"
                      class="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <div class="font-medium text-gray-900">
                      {{ addOn.name }}
                    </div>
                    <div v-if="addOn.description" class="text-sm text-gray-600">
                      {{ addOn.description }}
                    </div>
                  </div>
                </div>
                <div class="text-sm font-medium text-gray-900">
                  +${{ formatPrice(addOn.price) }}
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部價格和確認按鈕 -->
      <div class="sticky bottom-0 bg-white border-t border-gray-200 p-6">
        <div class="flex items-center justify-between mb-4">
          <span class="text-lg font-medium text-gray-900">總價</span>
          <span class="text-xl font-bold text-gray-900">
            ${{ formatPrice(totalPrice) }}
          </span>
        </div>
        <button
          :disabled="!isValidSelection"
          class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-2xl transition-colors"
          @click="handleConfirm"
        >
          確認選擇
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { formatPrice } from "@/utils/format";
import type {
  MenuItem,
  SelectedCustomizations,
} from "@makanmakan/shared-types";

// Props
const props = defineProps<{
  show: boolean;
  item?: MenuItem;
}>();

// Emits
const emits = defineEmits<{
  close: [];
  confirm: [customizations: SelectedCustomizations, totalPrice: number];
}>();

// State
const selectedSizeId = ref<string>();
const selectedOptions = ref<Record<string, string>>({});
const selectedMultipleOptions = ref<Record<string, string[]>>({});
const selectedAddOns = ref<string[]>([]);

// Helper functions for consistent key access
const getOptionKey = (option: any): string => {
  return String(option.id || "");
};

const getChoiceKey = (choice: any): string => {
  return String(choice.id || "");
};

const getAddOnKey = (addOn: any): string => {
  return String(addOn.id || "");
};

// Computed
const selectedSize = computed(() => {
  if (!selectedSizeId.value || !props.item?.options?.sizes) return undefined;
  return props.item.options.sizes.find(
    (size) => size.id === selectedSizeId.value,
  );
});

const totalPrice = computed(() => {
  if (!props.item) return 0;

  let price = props.item.price;

  // 尺寸價格調整
  if (selectedSize.value) {
    price += selectedSize.value.priceAdjustment || 0;
  }

  // 客製化選項價格
  if (props.item.options?.customizations) {
    for (const option of props.item.options.customizations) {
      const optionKey = getOptionKey(option);
      if (!optionKey) continue;

      if (option.type === "single" && selectedOptions.value[optionKey]) {
        const choice = option.choices?.find(
          (c) => getChoiceKey(c) === selectedOptions.value[optionKey],
        );
        if (choice) {
          price += choice.priceAdjustment || 0;
        }
      } else if (
        option.type === "multiple" &&
        selectedMultipleOptions.value[optionKey]
      ) {
        for (const choiceId of selectedMultipleOptions.value[optionKey]) {
          const choice = option.choices?.find(
            (c) => getChoiceKey(c) === choiceId,
          );
          if (choice) {
            price += choice.priceAdjustment || 0;
          }
        }
      }
    }
  }

  // 加購項目價格
  if (props.item.options?.addOns) {
    for (const addOnId of selectedAddOns.value) {
      const addOn = props.item.options.addOns.find(
        (a) => getAddOnKey(a) === addOnId,
      );
      if (addOn) {
        price += addOn.price;
      }
    }
  }

  return price;
});

const isValidSelection = computed(() => {
  if (!props.item) return false;

  // 檢查必選尺寸
  if (props.item.options?.sizes?.length && !selectedSizeId.value) {
    return false;
  }

  // 檢查必選客製化選項
  if (props.item.options?.customizations) {
    for (const option of props.item.options.customizations) {
      if (option.required) {
        if (
          option.type === "single" &&
          !selectedOptions.value[getOptionKey(option)]
        ) {
          return false;
        }
        if (
          option.type === "multiple" &&
          (!selectedMultipleOptions.value[getOptionKey(option)] ||
            selectedMultipleOptions.value[getOptionKey(option)].length === 0)
        ) {
          return false;
        }
      }
    }
  }

  return true;
});

// Methods
const handleConfirm = () => {
  if (!isValidSelection.value || !props.item) return;

  const customizations: SelectedCustomizations = {};

  // 尺寸
  if (selectedSize.value) {
    customizations.size = {
      id: selectedSize.value.id,
      name: selectedSize.value.name,
      priceAdjustment: selectedSize.value.priceAdjustment,
    };
  }

  // 客製化選項
  const options: Array<{
    id: string;
    optionName: string;
    choiceId: string;
    choiceName: string;
    priceAdjustment?: number;
  }> = [];

  if (props.item.options?.customizations) {
    for (const option of props.item.options.customizations) {
      const optionKey = getOptionKey(option);

      if (option.type === "single" && selectedOptions.value[optionKey]) {
        const choice = option.choices?.find(
          (c) => getChoiceKey(c) === selectedOptions.value[optionKey],
        );
        if (choice) {
          options.push({
            id: choice.id,
            optionName: option.name,
            choiceId: choice.id,
            choiceName: choice.name,
            priceAdjustment: choice.priceAdjustment,
          });
        }
      } else if (
        option.type === "multiple" &&
        selectedMultipleOptions.value[optionKey]
      ) {
        for (const choiceId of selectedMultipleOptions.value[optionKey]) {
          const choice = option.choices?.find(
            (c) => getChoiceKey(c) === choiceId,
          );
          if (choice) {
            options.push({
              id: choice.id,
              optionName: option.name,
              choiceId: choice.id,
              choiceName: choice.name,
              priceAdjustment: choice.priceAdjustment,
            });
          }
        }
      }
    }
  }

  if (options.length > 0) {
    customizations.options = options;
  }

  // 加購項目
  if (selectedAddOns.value.length > 0 && props.item.options?.addOns) {
    customizations.addOns = selectedAddOns.value.map((addOnId) => {
      const addOn = props.item!.options!.addOns!.find(
        (a) => getAddOnKey(a) === addOnId,
      )!;
      return {
        id: addOn.id,
        name: addOn.name,
        unitPrice: addOn.price,
        quantity: 1,
        totalPrice: addOn.price,
      };
    });
  }

  emits("confirm", customizations, totalPrice.value);
  resetForm();
};

const resetForm = () => {
  selectedSizeId.value = undefined;
  selectedOptions.value = {};
  selectedMultipleOptions.value = {};
  selectedAddOns.value = [];
};

// 監聽 show 屬性變化
watch(
  () => props.show,
  (newShow) => {
    if (!newShow) {
      resetForm();
    } else if (props.item?.options?.customizations) {
      // 初始化多選選項的響應式對象
      for (const option of props.item.options.customizations) {
        if (option.type === "multiple") {
          selectedMultipleOptions.value[getOptionKey(option)] = [];
        }
      }
    }
  },
);
</script>
