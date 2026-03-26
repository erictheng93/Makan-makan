<template>
  <div
    class="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden transition-all duration-300"
  >
    <!-- Collapsed header row -->
    <div class="px-4 py-3.5">
      <div class="flex items-start gap-3">
        <!-- Urgency dot -->
        <div
          class="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
          :class="urgencyColor"
        />

        <!-- Main info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-semibold text-[#1C1C1E] text-sm">
              {{ employeeName }}
            </span>
            <span
              class="text-xs font-medium px-2 py-0.5 rounded-full"
              :style="leaveTypeBadgeStyle"
            >
              {{ request.leaveTypeName || "請假" }}
            </span>
            <span class="text-xs text-[#1C1C1E]/50">
              {{ formatDateRange(request.startDate, request.endDate) }}
              ({{ request.days }}天)
            </span>
          </div>

          <!-- Balance snapshot -->
          <div v-if="balance" class="mt-1 text-xs text-[#1C1C1E]/50">
            餘額：{{ balance.leaveTypeName }}剩
            <span
              class="font-medium"
              :class="
                balance.remainingDays >= request.days
                  ? 'text-[#34C759]'
                  : 'text-[#FF3B30]'
              "
            >
              {{ balance.remainingDays }}天
            </span>
            （申請{{ request.days }}天）
          </div>

          <!-- Conflict warning (collapsed) -->
          <div
            v-if="conflictLevel === 'understaffed'"
            class="mt-1.5 flex items-center gap-1 text-xs text-[#FF3B30]"
          >
            <span>⚠</span>
            <span>當天人力低於門檻</span>
          </div>
          <div
            v-else-if="conflictLevel === 'has_colleagues'"
            class="mt-1.5 flex items-center gap-1 text-xs text-[#FF9500]"
          >
            <span>⚠</span>
            <span>當天已有{{ sameDayColleagues.length }}人請假</span>
          </div>
          <div
            v-else
            class="mt-1.5 flex items-center gap-1 text-xs text-[#34C759]"
          >
            <span>✓</span>
            <span>該時段人力充足</span>
          </div>
        </div>

        <!-- Expand toggle -->
        <button
          class="shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-[#F2F2F7] transition-colors text-[#1C1C1E]/40"
          @click="toggleExpanded"
        >
          <ChevronDown
            class="w-4 h-4 transition-transform duration-200"
            :class="isExpanded ? 'rotate-180' : ''"
          />
        </button>
      </div>

      <!-- Action buttons -->
      <div v-if="!showRejectInput" class="flex gap-2 mt-3">
        <button
          class="flex-1 py-2 rounded-full text-sm font-semibold bg-[#34C759] text-white hover:bg-[#2DB34A] transition-colors"
          :disabled="isProcessing"
          @click="handleApprove"
        >
          <span
            v-if="isProcessing && processingAction === 'approve'"
            class="flex items-center justify-center gap-1.5"
          >
            <span
              class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"
            />
            處理中
          </span>
          <span v-else>批准</span>
        </button>
        <button
          class="flex-1 py-2 rounded-full text-sm font-semibold border border-[#FF3B30] text-[#FF3B30] hover:bg-[#FF3B30]/8 transition-colors"
          :disabled="isProcessing"
          @click="showRejectInput = true"
        >
          拒絕
        </button>
      </div>

      <!-- Reject reason input -->
      <div v-else class="mt-3 space-y-2">
        <input
          v-model="rejectReason"
          type="text"
          placeholder="拒絕原因（可選）"
          class="w-full px-3 py-2 text-sm bg-[#F2F2F7] rounded-xl border-none focus:shadow-[0_0_0_2px_rgba(255,59,48,0.25)] focus:bg-white transition-all text-[#1C1C1E] placeholder-[#1C1C1E]/30"
          @keydown.enter="handleReject"
          @keydown.esc="showRejectInput = false"
        />
        <div class="flex gap-2">
          <button
            class="flex-1 py-2 rounded-full text-sm font-semibold bg-[#FF3B30] text-white hover:bg-[#D63027] transition-colors"
            :disabled="isProcessing"
            @click="handleReject"
          >
            <span
              v-if="isProcessing && processingAction === 'reject'"
              class="flex items-center justify-center gap-1.5"
            >
              <span
                class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"
              />
              處理中
            </span>
            <span v-else>確認拒絕</span>
          </button>
          <button
            class="px-4 py-2 rounded-full text-sm font-semibold text-[#1C1C1E]/60 hover:bg-[#F2F2F7] transition-colors"
            @click="
              showRejectInput = false;
              rejectReason = '';
            "
          >
            取消
          </button>
        </div>
      </div>
    </div>

    <!-- Expanded accordion: timeline + details -->
    <Transition name="accordion">
      <div
        v-if="isExpanded"
        class="border-t border-[#F2F2F7] px-4 py-3 bg-[#F2F2F7]/40"
      >
        <p
          class="text-xs font-semibold text-[#1C1C1E]/50 mb-2 uppercase tracking-wider"
        >
          排班概覽
        </p>
        <LeaveTimelineStrip
          :center-date="request.startDate"
          :leave-requests="teamLeaves"
          :current-request-id="request.id"
          :schedule-count="scheduleCount"
          :staffing-threshold="staffingThreshold"
        />

        <!-- Same-day colleagues list -->
        <div v-if="sameDayColleagues.length > 0" class="mt-3">
          <p class="text-xs font-semibold text-[#1C1C1E]/50 mb-1.5">
            同日請假同事
          </p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="col in sameDayColleagues"
              :key="col.id"
              class="text-xs px-2 py-0.5 bg-[#FF3B30]/10 text-[#FF3B30] rounded-full font-medium"
            >
              {{ col.employeeName || `員工${col.employeeId}` }}
            </span>
          </div>
        </div>

        <!-- Reason -->
        <div v-if="request.reason" class="mt-3">
          <p class="text-xs font-semibold text-[#1C1C1E]/50 mb-1">請假原因</p>
          <p class="text-sm text-[#1C1C1E]/70">{{ request.reason }}</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { ChevronDown } from "lucide-vue-next";
import LeaveTimelineStrip from "./LeaveTimelineStrip.vue";
import { useLeaveConflict } from "@/composables/useLeaveConflict";
import type { LeaveRequest, LeaveBalance } from "@/services/leavesService";

interface Props {
  request: LeaveRequest;
  balance: LeaveBalance | null;
  teamLeaves: LeaveRequest[];
  scheduleCount?: Record<string, number>;
  staffingThreshold?: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  approve: [requestId: number];
  reject: [requestId: number, reason?: string];
}>();

const isExpanded = ref(false);
const showRejectInput = ref(false);
const rejectReason = ref("");
const isProcessing = ref(false);
const processingAction = ref<"approve" | "reject" | null>(null);

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

const employeeName = computed(
  () => props.request.employeeName || `員工${props.request.employeeId}`,
);

const { sameDayColleagues, urgencyLevel } = useLeaveConflict(
  computed(() => props.request),
  computed(() => props.teamLeaves),
  computed(() => props.scheduleCount),
  computed(() => props.staffingThreshold),
);

const conflictLevel = urgencyLevel;

const urgencyColor = computed(() => {
  if (conflictLevel.value === "understaffed") return "bg-[#FF3B30]";
  if (conflictLevel.value === "has_colleagues") return "bg-[#FF9500]";
  return "bg-[#34C759]";
});

const leaveTypeBadgeStyle = computed(() => {
  const color = props.request.leaveTypeName ? "#007AFF" : "#8E8E93";
  return {
    backgroundColor: `${color}15`,
    color,
  };
});

const formatDateRange = (start: string, end: string): string => {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const fmt = (d: Date) =>
    `${d.getMonth() + 1}/${d.getDate()}(${weekDays[d.getDay()]})`;
  if (start === end) return fmt(s);
  return `${fmt(s)}-${fmt(e)}`;
};

const handleApprove = async () => {
  isProcessing.value = true;
  processingAction.value = "approve";
  try {
    emit("approve", props.request.id);
  } finally {
    isProcessing.value = false;
    processingAction.value = null;
  }
};

const handleReject = async () => {
  isProcessing.value = true;
  processingAction.value = "reject";
  try {
    emit("reject", props.request.id, rejectReason.value || undefined);
  } finally {
    isProcessing.value = false;
    processingAction.value = null;
    showRejectInput.value = false;
    rejectReason.value = "";
  }
};
</script>

<style scoped>
.accordion-enter-active,
.accordion-leave-active {
  transition:
    max-height 0.25s ease-out,
    opacity 0.2s ease-out;
  overflow: hidden;
  max-height: 400px;
}
.accordion-enter-from,
.accordion-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
