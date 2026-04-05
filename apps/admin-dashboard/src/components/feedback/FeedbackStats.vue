<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <p class="text-xs text-[#8E8E93] font-medium mb-1">{{ t("feedback.stats.total") }}</p>
      <p class="text-2xl font-bold text-[#1C1C1E]">{{ stats.total }}</p>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <p class="text-xs text-[#8E8E93] font-medium mb-1">{{ t("feedback.stats.open") }}</p>
      <p class="text-2xl font-bold text-[#007AFF]">{{ stats.byStatus.open ?? 0 }}</p>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <p class="text-xs text-[#8E8E93] font-medium mb-1">{{ t("feedback.stats.inProgress") }}</p>
      <p class="text-2xl font-bold text-[#FF9500]">{{ stats.byStatus.in_progress ?? 0 }}</p>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <p class="text-xs text-[#8E8E93] font-medium mb-1">{{ t("feedback.stats.resolved") }}</p>
      <p class="text-2xl font-bold text-[#34C759]">{{ stats.byStatus.resolved ?? 0 }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@/i18n";
import type { FeedbackStats } from "@/composables/useFeedback";

defineProps<{ stats: FeedbackStats }>();

const { t } = useI18n();
</script>
