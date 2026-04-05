<template>
  <div class="space-y-4">
    <!-- Metadata card -->
    <div class="bg-white rounded-2xl p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div class="flex-1">
          <h2 class="text-lg font-semibold text-[#1C1C1E] mb-1">
            {{ feedback.subject }}
          </h2>
          <div class="flex flex-wrap items-center gap-2 mt-2">
            <span
              class="px-2.5 py-0.5 rounded-full text-xs font-medium"
              :class="categoryClass(feedback.category)"
            >
              {{ t(`feedback.categories.${feedback.category}`) }}
            </span>
            <span
              class="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              :class="priorityClass(feedback.priority)"
            >
              {{ t(`feedback.priorities.${feedback.priority}`) }}
            </span>
            <span
              class="px-2.5 py-0.5 rounded-full text-xs font-semibold"
              :class="statusClass(feedback.status)"
            >
              {{ t(`feedback.statuses.${feedback.status}`) }}
            </span>
            <span class="px-2.5 py-0.5 rounded-full text-xs bg-gray-100 text-[#3C3C43]">
              {{ t(`feedback.modules.${feedback.relatedModule}`) }}
            </span>
          </div>
        </div>

        <!-- Admin: status update -->
        <div v-if="isAdmin" class="flex-shrink-0">
          <select
            :value="feedback.status"
            @change="handleStatusChange"
            class="px-3 py-1.5 bg-gray-50 border-0 rounded-xl text-sm text-[#1C1C1E] focus:ring-2 focus:ring-[#007AFF]/30 transition-all"
          >
            <option value="open">{{ t("feedback.statuses.open") }}</option>
            <option value="in_progress">{{ t("feedback.statuses.in_progress") }}</option>
            <option value="resolved">{{ t("feedback.statuses.resolved") }}</option>
            <option value="closed">{{ t("feedback.statuses.closed") }}</option>
          </select>
        </div>
      </div>

      <p class="text-sm text-[#3C3C43] leading-relaxed whitespace-pre-wrap">
        {{ feedback.description }}
      </p>

      <!-- Metadata footer -->
      <div class="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8E8E93]">
        <span v-if="feedback.restaurant">
          🏪 {{ feedback.restaurant.name }}
        </span>
        <span v-if="feedback.user">
          👤 {{ feedback.user.fullName || feedback.user.username }}
        </span>
        <span>{{ formatDate(feedback.createdAt) }}</span>
        <span v-if="feedback.resolvedAt" class="text-[#34C759]">
          ✓ {{ t("feedback.resolvedAt") }} {{ formatDate(feedback.resolvedAt) }}
        </span>
      </div>

      <!-- Attachments -->
      <div v-if="feedback.attachmentUrls?.length" class="mt-3 flex flex-wrap gap-2">
        <a
          v-for="(url, i) in feedback.attachmentUrls"
          :key="i"
          :href="url"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-[#007AFF]/10 text-[#007AFF] rounded-lg text-xs font-medium hover:bg-[#007AFF]/20 transition-colors"
        >
          <Paperclip class="w-3 h-3" />
          {{ t("feedback.attachment") }} {{ i + 1 }}
        </a>
      </div>
    </div>

    <!-- Responses thread -->
    <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-100">
        <h3 class="text-sm font-semibold text-[#1C1C1E]">
          {{ t("feedback.replies") }}
          <span class="ml-1 text-[#8E8E93] font-normal">
            ({{ visibleResponses.length }})
          </span>
        </h3>
      </div>

      <div v-if="visibleResponses.length" class="divide-y divide-gray-50">
        <div
          v-for="response in visibleResponses"
          :key="response.id"
          class="px-5 py-4"
          :class="response.isInternal ? 'bg-amber-50/50' : ''"
        >
          <div class="flex items-start gap-3">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              :class="
                response.isInternal
                  ? 'bg-amber-100 text-amber-700'
                  : isAdminUser(response.userId)
                  ? 'bg-[#007AFF]/10 text-[#007AFF]'
                  : 'bg-gray-100 text-[#3C3C43]'
              "
            >
              {{ getInitials(response.user) }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-xs font-semibold text-[#1C1C1E]">
                  {{ response.user?.fullName || response.user?.username || "—" }}
                </span>
                <span
                  v-if="response.isInternal"
                  class="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium"
                >
                  {{ t("feedback.internalNote") }}
                </span>
                <span class="text-[10px] text-[#8E8E93] ml-auto">
                  {{ formatDate(response.createdAt) }}
                </span>
              </div>
              <p class="text-sm text-[#3C3C43] leading-relaxed whitespace-pre-wrap">
                {{ response.message }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="px-5 py-8 text-center text-sm text-[#8E8E93]">
        {{ t("feedback.noReplies") }}
      </div>

      <!-- Reply input -->
      <div class="px-5 py-4 border-t border-gray-100 space-y-3">
        <textarea
          v-model="replyMessage"
          :placeholder="t('feedback.replyPlaceholder')"
          rows="3"
          maxlength="2000"
          class="w-full px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-sm text-[#1C1C1E] placeholder-[#8E8E93] focus:ring-2 focus:ring-[#007AFF]/30 focus:bg-white transition-all resize-none"
        />
        <div class="flex items-center justify-between gap-3">
          <label v-if="isAdmin" class="flex items-center gap-2 cursor-pointer">
            <input
              v-model="replyIsInternal"
              type="checkbox"
              class="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
            />
            <span class="text-xs text-[#3C3C43]">{{ t("feedback.markInternal") }}</span>
          </label>
          <div v-else />
          <button
            @click="handleReply"
            :disabled="!replyMessage.trim()"
            class="px-5 py-2 rounded-full text-sm font-semibold bg-[#007AFF] text-white hover:bg-[#0071E3] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            {{ t("feedback.sendReply") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Paperclip } from "lucide-vue-next";
import { useI18n } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { UserRole } from "@/types";
import { useFeedback } from "@/composables/useFeedback";
import type { FeedbackItem } from "@/composables/useFeedback";

const props = defineProps<{ feedback: FeedbackItem }>();
const emit = defineEmits<{
  statusChanged: [status: string];
  replyAdded: [];
}>();

const { t } = useI18n();
const authStore = useAuthStore();
const { addResponse, updateStatus } = useFeedback();

const isAdmin = computed(() => authStore.user?.role === UserRole.ADMIN);
const replyMessage = ref("");
const replyIsInternal = ref(false);

const visibleResponses = computed(() => props.feedback.responses ?? []);

function isAdminUser(userId: number) {
  // A heuristic — admin responses are those from non-restaurant users
  return userId !== props.feedback.userId;
}

function getInitials(
  user?: { username: string; fullName?: string } | null,
): string {
  if (!user) return "?";
  const name = user.fullName || user.username;
  return name.slice(0, 2).toUpperCase();
}

function formatDate(ts: string | number | null): string {
  if (!ts) return "—";
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

async function handleStatusChange(e: Event) {
  const status = (e.target as HTMLSelectElement).value;
  await updateStatus(props.feedback.id, status);
  emit("statusChanged", status);
}

async function handleReply() {
  if (!replyMessage.value.trim()) return;
  await addResponse(
    props.feedback.id,
    replyMessage.value.trim(),
    replyIsInternal.value,
  );
  replyMessage.value = "";
  replyIsInternal.value = false;
  emit("replyAdded");
}
</script>
