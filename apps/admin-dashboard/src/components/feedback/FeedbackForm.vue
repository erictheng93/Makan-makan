<template>
  <div class="bg-white rounded-2xl p-6 shadow-sm">
    <h3 class="text-lg font-semibold text-[#1C1C1E] mb-5">
      {{ t("feedback.form.title") }}
    </h3>

    <form @submit.prevent="handleSubmit" class="space-y-5">
      <!-- Category -->
      <div>
        <label class="block text-sm font-medium text-[#1C1C1E] mb-2">
          {{ t("feedback.form.category") }}
          <span class="text-[#FF3B30]">*</span>
        </label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="cat in categories"
            :key="cat.value"
            type="button"
            @click="form.category = cat.value"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
            :class="
              form.category === cat.value
                ? 'bg-[#007AFF] text-white shadow-sm'
                : 'bg-gray-100 text-[#3C3C43] hover:bg-gray-200'
            "
          >
            <component :is="cat.icon" class="w-3.5 h-3.5" />
            {{ t(`feedback.categories.${cat.value}`) }}
          </button>
        </div>
      </div>

      <!-- Priority & Module row -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-[#1C1C1E] mb-2">
            {{ t("feedback.form.priority") }}
          </label>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="p in priorities"
              :key="p.value"
              type="button"
              @click="form.priority = p.value"
              class="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200"
              :class="
                form.priority === p.value
                  ? p.activeClass
                  : 'bg-gray-100 text-[#3C3C43] hover:bg-gray-200'
              "
            >
              {{ t(`feedback.priorities.${p.value}`) }}
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-[#1C1C1E] mb-2">
            {{ t("feedback.form.relatedModule") }}
          </label>
          <select
            v-model="form.relatedModule"
            class="w-full px-3 py-2 bg-gray-50 border-0 rounded-xl text-sm text-[#1C1C1E] focus:ring-2 focus:ring-[#007AFF]/30 focus:bg-white transition-all"
          >
            <option v-for="mod in modules" :key="mod" :value="mod">
              {{ t(`feedback.modules.${mod}`) }}
            </option>
          </select>
        </div>
      </div>

      <!-- Subject -->
      <div>
        <label class="block text-sm font-medium text-[#1C1C1E] mb-2">
          {{ t("feedback.form.subject") }}
          <span class="text-[#FF3B30]">*</span>
        </label>
        <input
          v-model="form.subject"
          type="text"
          :placeholder="t('feedback.form.subjectPlaceholder')"
          maxlength="200"
          class="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm text-[#1C1C1E] placeholder-[#8E8E93] focus:ring-2 focus:ring-[#007AFF]/30 focus:bg-white transition-all"
        />
        <p class="mt-1 text-xs text-[#8E8E93] text-right">
          {{ form.subject.length }}/200
        </p>
      </div>

      <!-- Description -->
      <div>
        <label class="block text-sm font-medium text-[#1C1C1E] mb-2">
          {{ t("feedback.form.description") }}
          <span class="text-[#FF3B30]">*</span>
        </label>
        <textarea
          v-model="form.description"
          :placeholder="t('feedback.form.descriptionPlaceholder')"
          rows="5"
          maxlength="5000"
          class="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm text-[#1C1C1E] placeholder-[#8E8E93] focus:ring-2 focus:ring-[#007AFF]/30 focus:bg-white transition-all resize-none"
        />
        <p class="mt-1 text-xs text-[#8E8E93] text-right">
          {{ form.description.length }}/5000
        </p>
      </div>

      <!-- Actions -->
      <div class="flex gap-3 pt-1">
        <button
          type="button"
          @click="$emit('cancel')"
          class="flex-1 py-2.5 rounded-full text-sm font-medium bg-gray-100 text-[#3C3C43] hover:bg-gray-200 transition-all duration-200"
        >
          {{ t("common.cancel") }}
        </button>
        <button
          type="submit"
          :disabled="isSubmitting || !isValid"
          class="flex-1 py-2.5 rounded-full text-sm font-semibold bg-[#007AFF] text-white hover:bg-[#0071E3] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          <span v-if="isSubmitting">{{ t("common.submitting") }}</span>
          <span v-else>{{ t("feedback.form.submit") }}</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, computed } from "vue";
import {
  Bug,
  Lightbulb,
  MousePointerClick,
  Zap,
  CreditCard,
  HelpCircle,
} from "lucide-vue-next";
import { useI18n } from "@/i18n";
import { useFeedback } from "@/composables/useFeedback";

const emit = defineEmits<{
  cancel: [];
  submitted: [feedback: any];
}>();

const { t } = useI18n();
const { isSubmitting, submitFeedback } = useFeedback();

const form = reactive({
  category: "" as string,
  priority: "medium" as string,
  relatedModule: "other" as string,
  subject: "",
  description: "",
});

const categories = [
  { value: "bug_report", icon: Bug },
  { value: "feature_request", icon: Lightbulb },
  { value: "usability", icon: MousePointerClick },
  { value: "performance", icon: Zap },
  { value: "billing", icon: CreditCard },
  { value: "other", icon: HelpCircle },
];

const priorities = [
  { value: "low", activeClass: "bg-gray-500 text-white" },
  { value: "medium", activeClass: "bg-[#007AFF] text-white" },
  { value: "high", activeClass: "bg-[#FF9500] text-white" },
  { value: "urgent", activeClass: "bg-[#FF3B30] text-white" },
];

const modules = [
  "menu",
  "orders",
  "pos",
  "tables",
  "reservations",
  "scheduling",
  "analytics",
  "settings",
  "integrations",
  "other",
];

const isValid = computed(
  () =>
    form.category &&
    form.subject.trim().length >= 5 &&
    form.description.trim().length >= 10,
);

async function handleSubmit() {
  if (!isValid.value) return;
  const result = await submitFeedback({
    subject: form.subject.trim(),
    description: form.description.trim(),
    category: form.category,
    priority: form.priority,
    relatedModule: form.relatedModule,
  });
  emit("submitted", result);
}
</script>
