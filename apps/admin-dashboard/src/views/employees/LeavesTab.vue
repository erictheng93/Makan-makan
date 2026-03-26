<template>
  <div class="space-y-6">
    <div class="flex items-center justify-center h-64 text-[#1C1C1E]/40">
      <div class="text-center">
        <CalendarCheck class="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p class="text-lg font-medium">{{ t("employees.tabs.leaves") }}</p>
        <p class="text-sm">請假管理功能開發中</p>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { CalendarCheck } from "lucide-vue-next";
import { useI18n } from "@/i18n";
const { t } = useI18n();
</script>
