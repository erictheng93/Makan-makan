<template>
  <div class="w-full">
    <!-- Header with Filters -->
    <div class="mb-8 p-6 bg-white rounded-lg shadow border border-gray-200">
      <div class="mb-5">
        <div class="flex items-center gap-3 mb-2">
          <div class="p-2 bg-indigo-100 rounded-lg">
            <ArrowPathIcon class="h-6 w-6 text-indigo-600" />
          </div>
          <h2 class="text-2xl font-bold text-gray-900">換班申請管理</h2>
        </div>
        <p v-if="!loading" class="text-sm text-gray-600">
          共 {{ requests.length }} 筆申請
          <span v-if="pendingCount > 0" class="text-yellow-600 font-bold">
            ({{ pendingCount }} 筆待處理)
          </span>
        </p>
      </div>

      <!-- Status Filters -->
      <div class="flex gap-2 flex-wrap">
        <button
          v-for="status in statusFilters"
          :key="status.value"
          class="flex items-center gap-2 px-4 py-2.5 border-2 rounded-lg font-bold text-sm transition-all"
          :class="
            selectedStatus === status.value
              ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-md'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          "
          @click="selectedStatus = status.value"
        >
          <component
            :is="status.icon"
            class="h-4 w-4"
            :class="status.iconClass"
          />
          <span>{{ status.label }}</span>
          <span
            v-if="getStatusCount(status.value) > 0"
            class="flex items-center justify-center min-w-[22px] h-5 px-2 rounded-full text-xs font-bold"
            :class="
              selectedStatus === status.value
                ? 'bg-blue-600 text-white'
                : 'bg-blue-600 text-white'
            "
          >
            {{ getStatusCount(status.value) }}
          </span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-20">
      <div
        class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
      ></div>
      <p class="text-gray-600">載入換班申請中...</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredRequests.length === 0"
      class="text-center py-20 bg-white rounded-lg shadow"
    >
      <div class="flex items-center justify-center mb-6">
        <div class="p-6 bg-gray-100 rounded-full">
          <ArrowPathIcon class="h-16 w-16 text-gray-400" />
        </div>
      </div>
      <h3 class="text-xl font-bold text-gray-900 mb-3">
        {{
          selectedStatus === "all"
            ? "暫無換班申請"
            : `暫無${getStatusLabel(selectedStatus)}的申請`
        }}
      </h3>
      <p class="text-sm text-gray-600">
        {{
          selectedStatus === "all"
            ? "當員工提交換班申請時,將會顯示在這裡"
            : "切換篩選器查看其他狀態的申請"
        }}
      </p>
    </div>

    <!-- Requests List -->
    <div v-else class="space-y-5">
      <div
        v-for="request in filteredRequests"
        :key="request.id"
        class="bg-white rounded-lg border-2 shadow hover:shadow-lg transition-all duration-200 hover:-translate-y-1 overflow-hidden"
        :class="getStatusBorderClass(request.status)"
      >
        <!-- Card Header -->
        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 bg-gray-50 border-b border-gray-200"
        >
          <div
            class="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm border-2"
            :class="getStatusBadgeClass(request.status)"
          >
            <component
              :is="getStatusIconComponent(request.status)"
              class="h-4 w-4"
            />
            <span>{{ getStatusLabel(request.status) }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-600">
            <CalendarIcon class="h-4 w-4 text-gray-500" />
            <span>{{ formatDate(request.createdAt) }}</span>
          </div>
        </div>

        <!-- Card Content -->
        <div class="p-6 space-y-5">
          <!-- Requester Info -->
          <div class="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div class="flex items-center gap-2 mb-3">
              <UserIcon class="h-4 w-4 text-gray-500" />
              <h4
                class="text-xs font-bold text-gray-700 uppercase tracking-wide"
              >
                申請人
              </h4>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-base font-bold text-gray-900">{{
                request.requesterName
              }}</span>
              <span
                class="px-2.5 py-1 bg-gray-200 text-gray-700 rounded-md text-xs font-semibold"
              >
                {{ request.requesterRole || "員工" }}
              </span>
            </div>
          </div>

          <!-- Swap Flow -->
          <div class="p-5 bg-blue-50 rounded-xl border-2 border-blue-200">
            <div
              class="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-4 items-center"
            >
              <!-- Original Shift -->
              <div
                class="p-4 bg-white rounded-lg border-2 border-yellow-500 shadow-sm"
              >
                <div class="flex justify-between items-center mb-2">
                  <span
                    class="text-xs font-bold text-gray-500 uppercase tracking-wide"
                    >原班次</span
                  >
                  <span class="text-xs font-semibold text-gray-700">
                    {{
                      request.originalShiftDate
                        ? formatShiftDate(request.originalShiftDate)
                        : "-"
                    }}
                  </span>
                </div>
                <div class="text-lg font-bold text-gray-900 font-mono">
                  {{ request.originalStartTime }} -
                  {{ request.originalEndTime }}
                </div>
              </div>

              <!-- Arrow -->
              <div
                class="flex lg:flex-col items-center justify-center gap-1 text-blue-600"
              >
                <ArrowPathIcon class="h-8 w-8 lg:rotate-0 rotate-90" />
                <span class="text-xs font-bold uppercase">換班</span>
              </div>

              <!-- Target Shift -->
              <div
                class="p-4 bg-white rounded-lg border-2 border-blue-500 shadow-sm"
              >
                <div class="flex justify-between items-center mb-2">
                  <span
                    class="text-xs font-bold text-gray-500 uppercase tracking-wide"
                    >目標班次</span
                  >
                  <span class="text-xs font-semibold text-gray-700">
                    {{
                      request.targetShiftDate
                        ? formatShiftDate(request.targetShiftDate)
                        : "-"
                    }}
                  </span>
                </div>
                <div class="text-lg font-bold text-gray-900 font-mono">
                  {{ request.targetStartTime }} - {{ request.targetEndTime }}
                </div>
              </div>
            </div>
          </div>

          <!-- Target Employee -->
          <div
            v-if="request.targetEmployeeName"
            class="p-4 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div class="flex items-center gap-2 mb-3">
              <UserGroupIcon class="h-4 w-4 text-gray-500" />
              <h4
                class="text-xs font-bold text-gray-700 uppercase tracking-wide"
              >
                換班對象
              </h4>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-base font-bold text-gray-900">{{
                request.targetEmployeeName
              }}</span>
              <span
                class="px-2.5 py-1 bg-gray-200 text-gray-700 rounded-md text-xs font-semibold"
              >
                {{ request.targetEmployeeRole || "員工" }}
              </span>
            </div>
          </div>

          <!-- Reason -->
          <div
            v-if="request.reason"
            class="p-4 bg-yellow-50 rounded-lg border border-yellow-200"
          >
            <div class="flex items-center gap-2 mb-3">
              <DocumentTextIcon class="h-4 w-4 text-yellow-600" />
              <h4
                class="text-xs font-bold text-gray-700 uppercase tracking-wide"
              >
                申請原因
              </h4>
            </div>
            <p class="text-sm text-gray-700 leading-relaxed">
              {{ request.reason }}
            </p>
          </div>

          <!-- Response -->
          <div
            v-if="request.status !== 'pending' && request.responseNote"
            class="p-4 bg-gray-50 rounded-lg border border-gray-200"
          >
            <div class="flex items-center gap-2 mb-3">
              <ChatBubbleLeftEllipsisIcon class="h-4 w-4 text-gray-500" />
              <h4
                class="text-xs font-bold text-gray-700 uppercase tracking-wide"
              >
                處理回覆
              </h4>
            </div>
            <div class="space-y-2">
              <p class="text-sm text-gray-700 leading-relaxed">
                {{ request.responseNote }}
              </p>
              <div
                class="flex flex-col sm:flex-row sm:justify-between gap-2 pt-2 border-t border-gray-200 text-xs text-gray-600"
              >
                <span>由 {{ request.respondedBy || "管理員" }} 處理</span>
                <span>{{
                  request.respondedAt ? formatDate(request.respondedAt) : "-"
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Card Actions -->
        <div
          v-if="request.status === 'pending'"
          class="flex gap-3 p-4 bg-gray-50 border-t border-gray-200"
        >
          <button
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white text-red-600 border-2 border-red-600 rounded-lg hover:bg-red-50 transition-all hover:-translate-y-0.5 hover:shadow text-sm font-bold"
            @click="handleReject(request)"
          >
            <XMarkIcon class="h-5 w-5" />
            <span>拒絕</span>
          </button>
          <button
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white border-2 border-green-600 rounded-lg hover:bg-green-700 transition-all hover:-translate-y-0.5 hover:shadow text-sm font-bold"
            @click="handleApprove(request)"
          >
            <CheckIcon class="h-5 w-5" />
            <span>核准</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { SwapRequest } from "@/types/scheduling";
import {
  ArrowPathIcon,
  CalendarIcon,
  UserIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ChatBubbleLeftEllipsisIcon,
  XMarkIcon,
  CheckIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeSlashIcon,
  QuestionMarkCircleIcon,
} from "@heroicons/vue/24/outline";

interface Props {
  requests: SwapRequest[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
});

const emit = defineEmits<{
  approve: [request: SwapRequest];
  reject: [request: SwapRequest];
}>();

// State
const selectedStatus = ref<string>("all");

// Filters
const statusFilters = [
  {
    value: "all",
    label: "全部",
    icon: ChartBarIcon,
    iconClass: "text-gray-500",
  },
  {
    value: "pending",
    label: "待處理",
    icon: ClockIcon,
    iconClass: "text-yellow-500",
  },
  {
    value: "approved",
    label: "已核准",
    icon: CheckCircleIcon,
    iconClass: "text-green-500",
  },
  {
    value: "rejected",
    label: "已拒絕",
    icon: XCircleIcon,
    iconClass: "text-red-500",
  },
];

// Computed
const filteredRequests = computed(() => {
  if (selectedStatus.value === "all") {
    return props.requests;
  }
  return props.requests.filter((r) => r.status === selectedStatus.value);
});

const pendingCount = computed(() => {
  return props.requests.filter((r) => r.status === "pending").length;
});

const getStatusCount = (status: string): number => {
  if (status === "all") return props.requests.length;
  return props.requests.filter((r) => r.status === status).length;
};

// Styling Methods
const getStatusBorderClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: "border-l-yellow-500",
    approved: "border-l-green-500",
    rejected: "border-l-red-500",
    cancelled: "border-l-gray-500",
  };
  return classes[status] || "border-l-gray-300";
};

const getStatusBadgeClass = (status: string) => {
  const classes: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
    approved: "bg-green-100 text-green-800 border-green-300",
    rejected: "bg-red-100 text-red-800 border-red-300",
    cancelled: "bg-gray-100 text-gray-800 border-gray-300",
  };
  return classes[status] || "bg-gray-100 text-gray-700 border-gray-300";
};

const getStatusIconComponent = (status: string) => {
  const icons: Record<string, any> = {
    pending: ClockIcon,
    approved: CheckCircleIcon,
    rejected: XCircleIcon,
    cancelled: EyeSlashIcon,
  };
  return icons[status] || QuestionMarkCircleIcon;
};

// Label Methods
const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: "待處理",
    approved: "已核准",
    rejected: "已拒絕",
    cancelled: "已取消",
  };
  return labels[status] || status;
};

const formatDate = (dateString: string | Date): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatShiftDate = (dateString: string): string => {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[date.getDay()];
  return `${month}/${day} (${weekday})`;
};

// Event Handlers
const handleApprove = (request: SwapRequest) => {
  if (confirm(`確定要核准 ${request.requesterName} 的換班申請嗎？`)) {
    emit("approve", request);
  }
};

const handleReject = (request: SwapRequest) => {
  if (confirm(`確定要拒絕 ${request.requesterName} 的換班申請嗎？`)) {
    emit("reject", request);
  }
};
</script>
