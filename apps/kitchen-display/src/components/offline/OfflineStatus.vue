<template>
  <div
    v-if="isOffline"
    class="bg-ios-orange/10 rounded-2xl p-3 flex items-center gap-2"
  >
    <WifiOff class="w-5 h-5 text-ios-orange flex-shrink-0" />
    <span class="text-sm text-ios-orange font-medium"
      >離線模式 — 資料可能不是最新</span
    >
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from "vue";
import { WifiOff } from "lucide-vue-next";
import { useToast } from "vue-toastification";
import { offlineService } from "@/services/offlineService";

const toast = useToast();

// Props
interface Props {
  show?: boolean;
  autoHide?: boolean;
  showFloatingWidget?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
  autoHide: false,
  showFloatingWidget: true,
});

// Computed from offline service
const isOnline = computed(() => offlineService.isOnline.value);
const isOffline = computed(() => props.show && !offlineService.isOnline.value);
const pendingActions = computed(() => offlineService.pendingActions.value);
const syncConflicts = computed(() => offlineService.syncConflicts.value);
const syncInProgress = computed(() => offlineService.syncInProgress.value);
const lastSyncTime = computed(() => offlineService.lastSyncTime.value);

const pendingCount = computed(() => pendingActions.value.length);
const conflictCount = computed(() => syncConflicts.value.length);
const failedCount = computed(
  () => pendingActions.value.filter((a) => a.error).length,
);

// Auto-hide logic (kept from original)
let hideTimeout: NodeJS.Timeout | null = null;

const scheduleAutoHide = () => {
  if (!props.autoHide) return;

  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }

  if (isOnline.value && pendingCount.value === 0 && conflictCount.value === 0) {
    hideTimeout = setTimeout(() => {
      // no-op: isOffline computed handles visibility
    }, 5000);
  }
};

onMounted(() => {
  scheduleAutoHide();
});

onUnmounted(() => {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }
});

watch(
  () => props.autoHide,
  () => {
    if (props.autoHide) {
      scheduleAutoHide();
    }
  },
);

// Utility methods kept for compatibility
const forcSync = async () => {
  try {
    await offlineService.forcSync();
    toast.success("數據同步完成");
  } catch (error: any) {
    toast.error("同步失敗: " + error.message);
  }
};

const validateData = () => {
  const isValid = offlineService.validateCachedData();
  if (isValid) {
    toast.success("數據驗證通過");
  } else {
    toast.warning("數據驗證失敗，建議執行修復");
  }
};

const repairData = () => {
  const repaired = offlineService.repairData();
  if (repaired) {
    toast.success("數據修復完成");
  } else {
    toast.info("數據無需修復");
  }
};

const clearOfflineData = () => {
  offlineService.clearOfflineData();
  toast.success("離線數據已清除");
};

const resolveAllConflicts = (resolution: "local" | "server" | "merge") => {
  syncConflicts.value.forEach((conflict) => {
    offlineService.resolveConflict(conflict.id, resolution);
  });

  const resolutionText = {
    local: "保持本機版本",
    server: "使用伺服器版本",
    merge: "智能合併",
  }[resolution];

  toast.success(`已使用「${resolutionText}」解決所有衝突`);
};

defineExpose({
  forcSync,
  validateData,
  repairData,
  clearOfflineData,
  resolveAllConflicts,
  pendingCount,
  conflictCount,
  failedCount,
  syncInProgress,
  lastSyncTime,
  isOnline,
  isOffline,
});
</script>
