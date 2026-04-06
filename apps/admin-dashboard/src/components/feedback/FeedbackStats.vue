<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
          <MessageSquare class="w-4 h-4 text-[#3C3C43]" />
        </div>
        <p class="text-xs text-[#8E8E93] font-medium">{{ t("feedback.stats.total") }}</p>
      </div>
      <p class="text-2xl font-bold text-[#1C1C1E]">{{ stats.total }}</p>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-8 h-8 rounded-xl bg-[#007AFF]/10 flex items-center justify-center">
          <CircleDot class="w-4 h-4 text-[#007AFF]" />
        </div>
        <p class="text-xs text-[#8E8E93] font-medium">{{ t("feedback.stats.open") }}</p>
      </div>
      <p class="text-2xl font-bold text-[#007AFF]">{{ stats.byStatus.open ?? 0 }}</p>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-8 h-8 rounded-xl bg-[#FF9500]/10 flex items-center justify-center">
          <Clock class="w-4 h-4 text-[#FF9500]" />
        </div>
        <p class="text-xs text-[#8E8E93] font-medium">{{ t("feedback.stats.inProgress") }}</p>
      </div>
      <p class="text-2xl font-bold text-[#FF9500]">{{ stats.byStatus.in_progress ?? 0 }}</p>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-8 h-8 rounded-xl bg-[#34C759]/10 flex items-center justify-center">
          <CheckCircle class="w-4 h-4 text-[#34C759]" />
        </div>
        <p class="text-xs text-[#8E8E93] font-medium">{{ t("feedback.stats.resolved") }}</p>
      </div>
      <p class="text-2xl font-bold text-[#34C759]">{{ stats.byStatus.resolved ?? 0 }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MessageSquare, CircleDot, Clock, CheckCircle } from "lucide-vue-next";
import { useI18n } from "@/i18n";
import type { FeedbackStats } from "@/composables/useFeedback";

defineProps<{ stats: FeedbackStats }>();

const { t } = useI18n();
</script>
