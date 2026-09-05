<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <div
          class="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center"
        >
          <MessageSquare class="w-4 h-4 text-ios-text/85" />
        </div>
        <p class="text-xs text-ios-secondary font-medium">
          {{ t("feedback.stats.total") }}
        </p>
      </div>
      <p class="text-2xl font-bold text-ios-text">{{ stats.total }}</p>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <div
          class="w-8 h-8 rounded-xl bg-ios-blue/10 flex items-center justify-center"
        >
          <CircleDot class="w-4 h-4 text-ios-blue" />
        </div>
        <p class="text-xs text-ios-secondary font-medium">
          {{ t("feedback.stats.open") }}
        </p>
      </div>
      <p class="text-2xl font-bold text-ios-blue">
        {{ stats.byStatus.open ?? 0 }}
      </p>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <div
          class="w-8 h-8 rounded-xl bg-ios-orange/10 flex items-center justify-center"
        >
          <Clock class="w-4 h-4 text-ios-orange" />
        </div>
        <p class="text-xs text-ios-secondary font-medium">
          {{ t("feedback.stats.inProgress") }}
        </p>
      </div>
      <p class="text-2xl font-bold text-ios-orange">
        {{ stats.byStatus.in_progress ?? 0 }}
      </p>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <div
          class="w-8 h-8 rounded-xl bg-ios-green/10 flex items-center justify-center"
        >
          <CheckCircle class="w-4 h-4 text-ios-green" />
        </div>
        <p class="text-xs text-ios-secondary font-medium">
          {{ t("feedback.stats.resolved") }}
        </p>
      </div>
      <p class="text-2xl font-bold text-ios-green">
        {{ stats.byStatus.resolved ?? 0 }}
      </p>
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
