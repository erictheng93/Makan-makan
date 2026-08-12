<template>
  <div
    v-if="isOffline"
    data-testid="kitchen-offline-status"
    class="bg-ios-orange/10 rounded-2xl p-3 flex items-center gap-2"
  >
    <WifiOff class="w-5 h-5 text-ios-orange flex-shrink-0" />
    <span class="text-sm text-ios-orange font-medium">{{
      t("offlineStatus.offlineMessage")
    }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from "vue";
import { WifiOff } from "lucide-vue-next";
import { useI18n } from "@/i18n";
import { useToast } from "vue-toastification";
import { getErrorMessage } from "@/utils/unknown";

const { t } = useI18n();
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
    toast.success(t("offlineStatus.syncComplete"));
  } catch (error: unknown) {
    toast.error(t("offlineStatus.syncFailed") + getErrorMessage(error));
  }
};

const validateData = () => {
  const isValid = offlineService.validateCachedData();
  if (isValid) {
    toast.success(t("offlineStatus.validationPassed"));
  } else {
    toast.warning(t("offlineStatus.validationFailed"));
  }
};

const repairData = () => {
  const repaired = offlineService.repairData();
  if (repaired) {
    toast.success(t("offlineStatus.repairComplete"));
  } else {
    toast.info(t("offlineStatus.repairNotNeeded"));
  }
};

const clearOfflineData = () => {
  offlineService.clearOfflineData();
  toast.success(t("offlineStatus.offlineDataCleared"));
};

const resolveAllConflicts = (resolution: "local" | "server" | "merge") => {
  syncConflicts.value.forEach((conflict) => {
    offlineService.resolveConflict(conflict.id, resolution);
  });

  const resolutionText = {
    local: t("offlineStatus.keepLocal"),
    server: t("offlineStatus.useServer"),
    merge: t("offlineStatus.smartMerge"),
  }[resolution];

  toast.success(
    t("offlineStatus.conflictResolved", { strategy: resolutionText }),
  );
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
