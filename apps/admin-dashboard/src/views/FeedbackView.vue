<template>
  <div class="min-h-screen bg-[#F2F2F7] p-5 space-y-5">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-[#1C1C1E]">
          {{ t("feedback.title") }}
        </h1>
        <p class="text-sm text-[#8E8E93] mt-0.5">
          {{
            isAdmin
              ? t("feedback.adminSubtitle")
              : t("feedback.ownerSubtitle")
          }}
        </p>
      </div>
      <button
        v-if="!isAdmin && !showForm"
        @click="showForm = true"
        class="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#007AFF] text-white text-sm font-semibold hover:bg-[#0071E3] transition-all duration-200 shadow-sm"
      >
        <Plus class="w-4 h-4" />
        {{ t("feedback.submit") }}
      </button>
    </div>

    <!-- Feedback form (owner) -->
    <Transition name="fade-slide">
      <FeedbackForm
        v-if="showForm && !isAdmin"
        @cancel="showForm = false"
        @submitted="onSubmitted"
      />
    </Transition>

    <!-- Admin stats -->
    <FeedbackStats v-if="isAdmin && stats" :stats="stats" />

    <!-- Filters (admin only) -->
    <div v-if="isAdmin" class="bg-white rounded-2xl p-4 shadow-sm">
      <div class="flex flex-wrap gap-3">
        <input
          v-model="filters.search"
          type="text"
          :placeholder="t('feedback.searchPlaceholder')"
          @input="debouncedFetch"
          class="flex-1 min-w-48 px-4 py-2 bg-gray-50 border-0 rounded-xl text-sm text-[#1C1C1E] placeholder-[#8E8E93] focus:ring-2 focus:ring-[#007AFF]/30 focus:bg-white transition-all"
        />
        <select
          v-model="filters.status"
          @change="loadFeedback"
          class="px-3 py-2 bg-gray-50 border-0 rounded-xl text-sm text-[#1C1C1E] focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
        >
          <option value="">{{ t("feedback.allStatuses") }}</option>
          <option v-for="s in statuses" :key="s" :value="s">
            {{ t(`feedback.statuses.${s}`) }}
          </option>
        </select>
        <select
          v-model="filters.category"
          @change="loadFeedback"
          class="px-3 py-2 bg-gray-50 border-0 rounded-xl text-sm text-[#1C1C1E] focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
        >
          <option value="">{{ t("feedback.allCategories") }}</option>
          <option v-for="c in categories" :key="c" :value="c">
            {{ t(`feedback.categories.${c}`) }}
          </option>
        </select>
        <select
          v-model="filters.priority"
          @change="loadFeedback"
          class="px-3 py-2 bg-gray-50 border-0 rounded-xl text-sm text-[#1C1C1E] focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
        >
          <option value="">{{ t("feedback.allPriorities") }}</option>
          <option v-for="p in priorities" :key="p" :value="p">
            {{ t(`feedback.priorities.${p}`) }}
          </option>
        </select>
      </div>
    </div>

    <!-- Feedback list -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div
        class="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin"
      />
    </div>

    <div v-else-if="feedbackList.length === 0" class="bg-white rounded-2xl p-12 shadow-sm text-center">
      <MessageSquare class="w-12 h-12 text-[#C7C7CC] mx-auto mb-3" />
      <p class="text-[#8E8E93] text-sm">{{ t("feedback.noFeedback") }}</p>
      <button
        v-if="!isAdmin && !showForm"
        @click="showForm = true"
        class="mt-4 px-5 py-2.5 rounded-full bg-[#007AFF] text-white text-sm font-semibold hover:bg-[#0071E3] transition-all"
      >
        {{ t("feedback.submit") }}
      </button>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in feedbackList"
        :key="item.id"
        @click="openDetail(item)"
        class="bg-white rounded-2xl p-5 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200 active:scale-[0.99]"
      >
        <div class="flex items-start gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 mb-1.5">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                :class="categoryClass(item.category)"
              >
                {{ t(`feedback.categories.${item.category}`) }}
              </span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                :class="statusClass(item.status)"
              >
                {{ t(`feedback.statuses.${item.status}`) }}
              </span>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                :class="priorityClass(item.priority)"
              >
                {{ t(`feedback.priorities.${item.priority}`) }}
              </span>
            </div>
            <h3 class="text-sm font-semibold text-[#1C1C1E] truncate">
              {{ item.subject }}
            </h3>
            <p class="text-xs text-[#8E8E93] mt-1 line-clamp-2">
              {{ item.description }}
            </p>
            <div class="flex items-center gap-3 mt-2 text-[10px] text-[#C7C7CC]">
              <span v-if="isAdmin && item.restaurant">🏪 {{ item.restaurant.name }}</span>
              <span>{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-[#C7C7CC] flex-shrink-0 mt-1" />
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="pagination && pagination.totalPages > 1"
      class="flex items-center justify-center gap-2"
    >
      <button
        :disabled="pagination.page <= 1"
        @click="changePage(pagination.page - 1)"
        class="px-4 py-2 rounded-full text-sm font-medium bg-white shadow-sm text-[#007AFF] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
      >
        {{ t("common.previous") }}
      </button>
      <span class="text-sm text-[#8E8E93]">
        {{ pagination.page }} / {{ pagination.totalPages }}
      </span>
      <button
        :disabled="pagination.page >= pagination.totalPages"
        @click="changePage(pagination.page + 1)"
        class="px-4 py-2 rounded-full text-sm font-medium bg-white shadow-sm text-[#007AFF] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-all"
      >
        {{ t("common.next") }}
      </button>
    </div>

    <!-- Detail drawer -->
    <Teleport to="body">
      <Transition name="sheet">
        <div
          v-if="selectedFeedback"
          class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        >
          <div
            class="absolute inset-0 bg-black/30 backdrop-blur-sm"
            @click="selectedFeedback = null"
          />
          <div
            class="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#F2F2F7] rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
          >
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-base font-semibold text-[#1C1C1E]">
                {{ t("feedback.detailTitle") }}
              </h2>
              <button
                @click="selectedFeedback = null"
                class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-[#3C3C43] hover:bg-gray-300 transition-colors"
              >
                <X class="w-4 h-4" />
              </button>
            </div>
            <FeedbackDetail
              :feedback="selectedFeedback"
              @status-changed="onStatusChanged"
              @reply-added="onReplyAdded"
              @reply-updated="onReplyUpdated"
              @reply-deleted="onReplyDeleted"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from "vue";
import { Plus, MessageSquare, ChevronRight, X } from "lucide-vue-next";
import { useI18n } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { UserRole } from "@/types";
import { useFeedback } from "@/composables/useFeedback";
import FeedbackForm from "@/components/feedback/FeedbackForm.vue";
import FeedbackDetail from "@/components/feedback/FeedbackDetail.vue";
import FeedbackStats from "@/components/feedback/FeedbackStats.vue";
import type { FeedbackItem, FeedbackStats as FeedbackStatsType } from "@/composables/useFeedback";

const { t } = useI18n();
const authStore = useAuthStore();
const { isLoading, fetchFeedback, fetchFeedbackById, updateStatus, fetchStats } = useFeedback();

const isAdmin = computed(() => authStore.user?.role === UserRole.ADMIN);
const showForm = ref(false);
const feedbackList = ref<FeedbackItem[]>([]);
const selectedFeedback = ref<FeedbackItem | null>(null);
const stats = ref<FeedbackStatsType | null>(null);
const pagination = ref<{ page: number; limit: number; total: number; totalPages: number } | null>(null);

const filters = reactive({
  search: "",
  status: "",
  category: "",
  priority: "",
  page: 1,
});

const categories = ["bug_report", "feature_request", "usability", "performance", "billing", "other"];
const statuses = ["open", "in_progress", "resolved", "closed"];
const priorities = ["low", "medium", "high", "urgent"];

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedFetch() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => loadFeedback(), 400);
}

async function loadFeedback() {
  const params: any = { page: filters.page, limit: 20 };
  if (filters.search) params.search = filters.search;
  if (filters.status) params.status = filters.status;
  if (filters.category) params.category = filters.category;
  if (filters.priority) params.priority = filters.priority;

  const result = await fetchFeedback(params);
  feedbackList.value = result.feedback;
  pagination.value = result.pagination;
}

async function loadStats() {
  if (!isAdmin.value) return;
  stats.value = await fetchStats();
}

function changePage(page: number) {
  filters.page = page;
  loadFeedback();
}

async function openDetail(item: FeedbackItem) {
  selectedFeedback.value = await fetchFeedbackById(item.id);
}

function onSubmitted(feedback: FeedbackItem) {
  showForm.value = false;
  feedbackList.value.unshift(feedback);
}

function onStatusChanged(status: string) {
  if (selectedFeedback.value) {
    selectedFeedback.value = { ...selectedFeedback.value, status };
    const idx = feedbackList.value.findIndex((f) => f.id === selectedFeedback.value!.id);
    if (idx !== -1) feedbackList.value[idx] = { ...feedbackList.value[idx], status };
    loadStats();
  }
}

async function onReplyAdded() {
  if (selectedFeedback.value) {
    selectedFeedback.value = await fetchFeedbackById(selectedFeedback.value.id);
  }
}

function onReplyUpdated(responseId: number, message: string) {
  if (!selectedFeedback.value?.responses) return;
  const responses = selectedFeedback.value.responses.map((r) =>
    r.id === responseId ? { ...r, message } : r,
  );
  selectedFeedback.value = { ...selectedFeedback.value, responses };
}

function onReplyDeleted(responseId: number) {
  if (!selectedFeedback.value?.responses) return;
  const responses = selectedFeedback.value.responses.filter(
    (r) => r.id !== responseId,
  );
  selectedFeedback.value = { ...selectedFeedback.value, responses };
}

function formatDate(ts: string | number): string {
  return new Date(ts).toLocaleString();
}

function categoryClass(cat: string): string {
  const map: Record<string, string> = {
    bug_report: "bg-[#FF3B30]/10 text-[#FF3B30]",
    feature_request: "bg-[#34C759]/10 text-[#34C759]",
    usability: "bg-[#007AFF]/10 text-[#007AFF]",
    performance: "bg-[#FF9500]/10 text-[#FF9500]",
    billing: "bg-purple-100 text-purple-700",
    other: "bg-gray-100 text-[#3C3C43]",
  };
  return map[cat] ?? "bg-gray-100 text-[#3C3C43]";
}

function priorityClass(p: string): string {
  const map: Record<string, string> = {
    low: "bg-gray-100 text-[#8E8E93]",
    medium: "bg-[#007AFF]/10 text-[#007AFF]",
    high: "bg-[#FF9500]/10 text-[#FF9500]",
    urgent: "bg-[#FF3B30]/10 text-[#FF3B30]",
  };
  return map[p] ?? "bg-gray-100 text-[#3C3C43]";
}

function statusClass(s: string): string {
  const map: Record<string, string> = {
    open: "bg-[#007AFF]/10 text-[#007AFF]",
    in_progress: "bg-[#FF9500]/10 text-[#FF9500]",
    resolved: "bg-[#34C759]/10 text-[#34C759]",
    closed: "bg-gray-100 text-[#8E8E93]",
  };
  return map[s] ?? "bg-gray-100 text-[#3C3C43]";
}

onMounted(() => {
  loadFeedback();
  loadStats();
});
</script>

<style scoped>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s ease-out;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.3s ease-out;
}
.sheet-enter-from .sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from > div:last-child {
  transform: translateY(100%);
}
</style>
