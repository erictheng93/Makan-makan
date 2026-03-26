<template>
  <div
    class="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden"
  >
    <!-- Empty state -->
    <div
      v-if="balances.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <div
        class="w-12 h-12 rounded-full bg-[#007AFF]/10 flex items-center justify-center mb-3"
      >
        <BarChart3 class="w-6 h-6 text-[#007AFF]" />
      </div>
      <p class="text-sm font-semibold text-[#1C1C1E]/60">暫無假期餘額資料</p>
    </div>

    <div v-else>
      <!-- Table header -->
      <div
        class="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_120px] gap-x-3 px-4 py-2.5 border-b border-[#F2F2F7] text-xs font-semibold text-[#1C1C1E]/40 uppercase tracking-wider"
      >
        <span>員工</span>
        <span>假別</span>
        <span class="text-right">總天數</span>
        <span class="text-right">已用</span>
        <span class="text-right">待審</span>
        <span class="text-right">餘額</span>
        <span class="text-right">使用率</span>
      </div>

      <!-- Table rows -->
      <div
        v-for="(balance, index) in sortedBalances"
        :key="balance.id"
        class="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_120px] gap-x-3 px-4 py-3 text-sm items-center"
        :class="index % 2 === 1 ? 'bg-[#F2F2F7]/40' : ''"
      >
        <span class="font-medium text-[#1C1C1E] truncate">
          {{ getEmployeeName(balance.employeeId) }}
        </span>
        <div class="flex items-center gap-1.5 min-w-0">
          <span
            v-if="balance.color"
            class="w-2 h-2 rounded-full shrink-0"
            :style="{ backgroundColor: balance.color }"
          />
          <span class="text-[#1C1C1E]/70 truncate">{{
            balance.leaveTypeName
          }}</span>
        </div>
        <span class="text-right text-[#1C1C1E]/50">{{
          balance.totalDays
        }}</span>
        <span class="text-right text-[#1C1C1E]/50">{{ balance.usedDays }}</span>
        <span class="text-right text-[#FF9500]">{{ balance.pendingDays }}</span>
        <span
          class="text-right font-semibold"
          :class="
            balance.remainingDays > 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'
          "
        >
          {{ balance.remainingDays }}
        </span>
        <!-- Usage progress bar -->
        <div class="flex items-center gap-1.5 justify-end">
          <div class="w-16 h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="usageBarColor(balance)"
              :style="{ width: `${Math.min(usagePct(balance), 100)}%` }"
            />
          </div>
          <span
            class="text-xs font-medium w-8 text-right"
            :class="usageTextColor(balance)"
          >
            {{ usagePct(balance) }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { BarChart3 } from "lucide-vue-next";
import type { LeaveBalance } from "@/services/leavesService";

interface Props {
  balances: LeaveBalance[];
  employees: Array<{ id: number; name: string }>;
}

const props = defineProps<Props>();

const getEmployeeName = (employeeId: number): string => {
  const emp = props.employees.find((e) => e.id === employeeId);
  return emp?.name || `員工${employeeId}`;
};

const usagePct = (b: LeaveBalance): number => {
  if (b.totalDays === 0) return 0;
  return Math.round(((b.usedDays + b.pendingDays) / b.totalDays) * 100);
};

const usageBarColor = (b: LeaveBalance): string => {
  const pct = usagePct(b);
  if (pct >= 90) return "bg-[#FF3B30]";
  if (pct >= 70) return "bg-[#FF9500]";
  return "bg-[#34C759]";
};

const usageTextColor = (b: LeaveBalance): string => {
  const pct = usagePct(b);
  if (pct >= 90) return "text-[#FF3B30]";
  if (pct >= 70) return "text-[#FF9500]";
  return "text-[#34C759]";
};

const sortedBalances = computed(() =>
  [...props.balances].sort((a, b) => {
    // Sort by employee name, then leave type name
    const nameA = getEmployeeName(a.employeeId);
    const nameB = getEmployeeName(b.employeeId);
    const nameCmp = nameA.localeCompare(nameB);
    if (nameCmp !== 0) return nameCmp;
    return a.leaveTypeName.localeCompare(b.leaveTypeName);
  }),
);
</script>
