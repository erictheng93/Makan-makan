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
        class="w-12 h-12 rounded-full bg-ios-blue/10 flex items-center justify-center mb-3"
      >
        <BarChart3 class="w-6 h-6 text-ios-blue" />
      </div>
      <p class="text-sm font-semibold text-ios-text/60">暫無假期餘額資料</p>
      <button
        class="mt-3 px-4 py-2 rounded-full text-sm font-semibold bg-ios-blue text-white hover:bg-blue-600 transition-colors"
        @click="$emit('accrue')"
      >
        初始化假期餘額
      </button>
    </div>

    <div v-else>
      <!-- Table header -->
      <div
        class="grid grid-cols-[1fr_1fr_auto_auto_auto_auto_120px] gap-x-3 px-4 py-2.5 border-b border-ios-bg text-xs font-semibold text-ios-text/40 uppercase tracking-wider"
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
        :class="index % 2 === 1 ? 'bg-ios-bg/40' : ''"
      >
        <span class="font-medium text-ios-text truncate">
          {{ getEmployeeName(balance.employeeId) }}
        </span>
        <div class="flex items-center gap-1.5 min-w-0">
          <span
            v-if="balance.color"
            class="w-2 h-2 rounded-full shrink-0"
            :style="{ backgroundColor: balance.color }"
          />
          <span class="text-ios-text/70 truncate">{{
            balance.leaveTypeName
          }}</span>
        </div>
        <span class="text-right text-ios-text/50">{{ balance.totalDays }}</span>
        <span class="text-right text-ios-text/50">{{ balance.usedDays }}</span>
        <span class="text-right text-ios-orange">{{
          balance.pendingDays
        }}</span>
        <span
          class="text-right font-semibold"
          :class="balance.remainingDays > 0 ? 'text-ios-green' : 'text-ios-red'"
        >
          {{ balance.remainingDays }}
        </span>
        <!-- Usage progress bar -->
        <div class="flex items-center gap-1.5 justify-end">
          <div class="w-16 h-1.5 bg-ios-bg rounded-full overflow-hidden">
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

defineEmits<{
  accrue: [];
}>();

const employeeMap = computed(
  () => new Map(props.employees.map((e) => [e.id, e.name])),
);

const getEmployeeName = (employeeId: number): string =>
  employeeMap.value.get(employeeId) ?? `員工 #${employeeId}`;

const usagePct = (b: LeaveBalance): number => {
  if (b.totalDays === 0) return 0;
  return Math.round(((b.usedDays + b.pendingDays) / b.totalDays) * 100);
};

const usageBarColor = (b: LeaveBalance): string => {
  const pct = usagePct(b);
  if (pct >= 90) return "bg-ios-red";
  if (pct >= 70) return "bg-ios-orange";
  return "bg-ios-green";
};

const usageTextColor = (b: LeaveBalance): string => {
  const pct = usagePct(b);
  if (pct >= 90) return "text-ios-red";
  if (pct >= 70) return "text-ios-orange";
  return "text-ios-green";
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
