<template>
  <!-- Modal overlay -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center"
    @click.self="$emit('cancel')"
  >
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

    <!-- Modal card -->
    <div
      data-category-form
      data-testid="admin-category-form"
      class="relative bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-6 w-full max-w-md mx-4"
    >
      <div class="flex items-center gap-2 mb-5">
        <span class="w-2 h-2 rounded-full bg-ios-success" />
        <h3 class="text-[17px] font-bold text-[#1C1C1E]">
          {{ isEditing ? t("menu.editCategory") : t("menu.addCategory") }}
        </h3>
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <div>
            <label
              class="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5"
            >
              {{ t("menu.form.categoryName") }}
              <span class="text-ios-error">*</span>
            </label>
            <input
              ref="nameInput"
              v-model="form.name"
              data-testid="admin-category-name-input"
              type="text"
              required
              :placeholder="t('menu.form.categoryNamePlaceholder')"
              class="w-full px-3.5 py-2.5 bg-[#F2F2F7] border-none rounded-xl text-sm text-[#1C1C1E] outline-none transition-all duration-200 focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:bg-white placeholder:text-[#AEAEB2]"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label
                class="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5"
              >
                {{ t("menu.form.nameEn") }}
              </label>
              <input
                v-model="form.nameEn"
                data-testid="admin-category-name-en-input"
                type="text"
                placeholder="English name"
                class="w-full px-3.5 py-2.5 bg-[#F2F2F7] border-none rounded-xl text-sm text-[#1C1C1E] outline-none transition-all duration-200 focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:bg-white placeholder:text-[#AEAEB2]"
              />
            </div>
            <div>
              <label
                class="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5"
              >
                {{ t("menu.form.sortOrder") }}
              </label>
              <input
                v-model.number="form.sortOrder"
                data-testid="admin-category-sort-order-input"
                type="number"
                min="0"
                class="w-full px-3.5 py-2.5 bg-[#F2F2F7] border-none rounded-xl text-sm text-[#1C1C1E] outline-none transition-all duration-200 focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:bg-white placeholder:text-[#AEAEB2]"
              />
            </div>
          </div>

          <div>
            <label
              class="block text-xs font-semibold text-[#8E8E93] uppercase tracking-wider mb-1.5"
            >
              {{ t("menu.form.description") }}
            </label>
            <input
              v-model="form.description"
              data-testid="admin-category-description-input"
              type="text"
              :placeholder="t('menu.form.descriptionPlaceholder')"
              class="w-full px-3.5 py-2.5 bg-[#F2F2F7] border-none rounded-xl text-sm text-[#1C1C1E] outline-none transition-all duration-200 focus:shadow-[0_0_0_2px_rgba(0,122,255,0.25)] focus:bg-white placeholder:text-[#AEAEB2]"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-5">
          <button
            type="button"
            data-testid="admin-category-cancel"
            class="px-4 py-2 rounded-full text-[13px] font-medium text-[#8E8E93] hover:bg-black/[0.04] transition-colors"
            @click="$emit('cancel')"
          >
            {{ t("common.cancel") }}
          </button>
          <button
            type="submit"
            data-testid="admin-category-submit"
            class="px-5 py-2 rounded-full text-[13px] font-semibold bg-ios-primary text-white hover:bg-[#0066D6] transition-colors"
          >
            {{ isEditing ? t("menu.form.update") : t("menu.form.add") }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useI18n } from "@/i18n";
import type { CategoryData } from "@/composables/useMenuManagement";

const { t } = useI18n();

const props = defineProps<{
  editingCategory?: CategoryData | null;
}>();

const emit = defineEmits<{
  save: [
    form: {
      name: string;
      nameEn: string;
      description: string;
      sortOrder: number;
    },
    editingId?: number,
  ];
  cancel: [];
}>();

const nameInput = ref<HTMLInputElement>();

const form = ref({
  name: "",
  nameEn: "",
  description: "",
  sortOrder: 0,
});

const isEditing = ref(false);

watch(
  () => props.editingCategory,
  (cat) => {
    if (cat) {
      isEditing.value = true;
      form.value = {
        name: cat.name,
        nameEn: cat.nameEn || "",
        description: cat.description || "",
        sortOrder: cat.sortOrder,
      };
    } else {
      isEditing.value = false;
      form.value = { name: "", nameEn: "", description: "", sortOrder: 0 };
    }
    nextTick(() => nameInput.value?.focus());
  },
  { immediate: true },
);

const handleSubmit = () => {
  emit("save", { ...form.value }, props.editingCategory?.id);
};
</script>
