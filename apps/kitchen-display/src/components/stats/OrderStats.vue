<template>
  <div class="grid grid-cols-4 gap-3">
    <!-- Pending -->
    <div
      class="bg-gradient-to-br from-[#FFF3E0] to-[#FFE0B2] rounded-2xl p-3 text-center shadow-card-sm"
    >
      <div class="text-kitchen-stats text-[#E65100]">
        {{ stats.pendingCount }}
      </div>
      <div class="text-xs font-semibold text-[#E65100]">
        {{ t("stats.pending") }}
      </div>
    </div>

    <!-- Preparing -->
    <div
      class="bg-gradient-to-br from-[#E3F2FD] to-[#BBDEFB] rounded-2xl p-3 text-center shadow-card-sm"
    >
      <div class="text-kitchen-stats text-[#0D47A1]">
        {{ stats.preparingCount }}
      </div>
      <div class="text-xs font-semibold text-[#0D47A1]">
        {{ t("stats.preparing") }}
      </div>
    </div>

    <!-- Ready -->
    <div
      class="bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] rounded-2xl p-3 text-center shadow-card-sm"
    >
      <div class="text-kitchen-stats text-[#1B5E20]">
        {{ stats.readyCount }}
      </div>
      <div class="text-xs font-semibold text-[#1B5E20]">
        {{ t("stats.completed") }}
      </div>
    </div>

    <!-- Urgent -->
    <div
      class="bg-gradient-to-br from-[#FFEBEE] to-[#FFCDD2] rounded-2xl p-3 text-center shadow-card-sm"
    >
      <div class="text-kitchen-stats text-[#B71C1C]">
        {{ stats.urgentOrders }}
      </div>
      <div class="text-xs font-semibold text-[#B71C1C]">
        {{ t("stats.urgentOrders") }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@/i18n";
import type { KitchenStats } from "@/types";

const { t } = useI18n();

interface Props {
  stats: KitchenStats;
  loading?: boolean;
}

defineProps<Props>();

defineEmits<{
  refresh: [];
}>();
</script>
