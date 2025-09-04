<template>
  <div
    class="audio-settings bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center space-x-3">
        <div
          class="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center"
        >
          <SpeakerWaveIcon class="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-900">音頻通知設置</h3>
          <p class="text-sm text-gray-600">配置系統音效和通知聲音</p>
        </div>
      </div>

      <div class="flex items-center space-x-3">
        <!-- Audio Status -->
        <div class="flex items-center space-x-2">
          <div
            :class="[
              'w-3 h-3 rounded-full',
              audioEnabled ? 'bg-green-500' : 'bg-gray-300',
            ]"
          />
          <span class="text-sm font-medium text-gray-700">
            音頻{{ audioEnabled ? "已啟用" : "已停用" }}
          </span>
        </div>

        <!-- Master Toggle -->
        <button
          :class="[
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2',
            audioEnabled ? 'bg-indigo-600' : 'bg-gray-200',
          ]"
          @click="toggleAudio"
        >
          <span
            :class="[
              'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              audioEnabled ? 'translate-x-5' : 'translate-x-0',
            ]"
          />
        </button>
      </div>
    </div>

    <!-- Master Volume Control -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-3">
        <label class="text-md font-semibold text-gray-900">主音量控制</label>
        <span class="text-sm text-gray-600"
          >{{ Math.round(masterVolume * 100) }}%</span
        >
      </div>

      <div class="flex items-center space-x-4">
        <SpeakerXMarkIcon class="w-5 h-5 text-gray-400" />
        <input
          v-model.number="masterVolume"
          type="range"
          min="0"
          max="1"
          step="0.1"
          :disabled="!audioEnabled"
          class="flex-1 h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
          @input="updateMasterVolume"
        />
        <SpeakerWaveIcon class="w-5 h-5 text-gray-600" />
      </div>
    </div>

    <!-- Sound Categories -->
    <div class="mb-6">
      <h4 class="text-md font-semibold text-gray-900 mb-4">音效分類設置</h4>

      <div class="space-y-4">
        <div
          v-for="(category, categoryKey) in soundCategories"
          :key="categoryKey"
          class="bg-gray-50 rounded-lg p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center space-x-3">
              <component :is="category.icon" class="w-5 h-5 text-gray-600" />
              <span class="font-medium text-gray-900">{{
                category.title
              }}</span>
            </div>
            <input
              v-model="category.enabled"
              type="checkbox"
              :disabled="!audioEnabled"
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              @change="updateCategorySettings(categoryKey)"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="soundType in category.sounds"
              :key="soundType"
              class="flex items-center justify-between p-3 bg-white rounded-lg"
            >
              <div class="flex items-center space-x-3">
                <span class="text-sm text-gray-700">{{
                  getSoundLabel(soundType)
                }}</span>
                <button
                  :disabled="!audioEnabled || !category.enabled"
                  class="p-1 text-indigo-600 hover:text-indigo-700 disabled:text-gray-400"
                  title="測試音效"
                  @click="testSound(soundType)"
                >
                  <PlayIcon class="w-4 h-4" />
                </button>
              </div>

              <div class="flex items-center space-x-3">
                <input
                  v-model="soundSettings[soundType].enabled"
                  type="checkbox"
                  :disabled="!audioEnabled || !category.enabled"
                  class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  @change="updateSoundSettings(soundType)"
                />
                <input
                  v-model.number="soundSettings[soundType].volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  :disabled="
                    !audioEnabled ||
                    !category.enabled ||
                    !soundSettings[soundType].enabled
                  "
                  class="w-20 h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer"
                  @input="updateSoundSettings(soundType)"
                />
                <span class="text-xs text-gray-500 w-8">
                  {{ Math.round(soundSettings[soundType].volume * 100) }}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Advanced Settings -->
    <div class="mb-6">
      <h4 class="text-md font-semibold text-gray-900 mb-4">進階設置</h4>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-gray-50 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="font-medium text-gray-900">通知佇列</span>
            <input
              v-model="notificationQueue"
              type="checkbox"
              :disabled="!audioEnabled"
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              @change="updateAdvancedSettings"
            />
          </div>
          <p class="text-sm text-gray-600">
            啟用時會將音效通知排入佇列依序播放
          </p>
        </div>

        <div class="bg-gray-50 rounded-lg p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="font-medium text-gray-900">優先級覆蓋</span>
            <input
              v-model="priorityOverride"
              type="checkbox"
              :disabled="!audioEnabled || !notificationQueue"
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              @change="updateAdvancedSettings"
            />
          </div>
          <p class="text-sm text-gray-600">高優先級音效可打斷低優先級音效</p>
        </div>

        <div class="bg-gray-50 rounded-lg p-4">
          <label class="block font-medium text-gray-900 mb-2"
            >最大佇列大小</label
          >
          <div class="flex items-center space-x-2">
            <input
              v-model.number="maxQueueSize"
              type="number"
              min="1"
              max="20"
              :disabled="!audioEnabled || !notificationQueue"
              class="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              @input="updateAdvancedSettings"
            />
            <span class="text-sm text-gray-600">個通知</span>
          </div>
        </div>

        <div class="bg-gray-50 rounded-lg p-4">
          <label class="block font-medium text-gray-900 mb-2"
            >音效淡出時間</label
          >
          <div class="flex items-center space-x-2">
            <input
              v-model.number="fadeOutTime"
              type="number"
              min="0"
              max="5000"
              step="100"
              :disabled="!audioEnabled"
              class="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              @input="updateAdvancedSettings"
            />
            <span class="text-sm text-gray-600">毫秒</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Control Actions -->
    <div class="flex justify-between items-center">
      <div class="flex space-x-3">
        <button
          :disabled="!audioEnabled || isTesting"
          class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="testAllSounds"
        >
          <PlayIcon v-if="!isTesting" class="w-4 h-4 inline mr-2" />
          <div
            v-else
            class="w-4 h-4 inline mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"
          />
          {{ isTesting ? "測試中..." : "測試所有音效" }}
        </button>

        <button
          :disabled="!audioEnabled"
          class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="stopAllSounds"
        >
          <StopIcon class="w-4 h-4 inline mr-2" />
          停止所有音效
        </button>
      </div>

      <div class="flex space-x-3">
        <button
          class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          @click="resetToDefaults"
        >
          重設預設值
        </button>

        <button
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          @click="saveSettings"
        >
          保存設置
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import {
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PlayIcon,
  StopIcon,
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from "@heroicons/vue/24/outline";
import { useToast } from "vue-toastification";
import { audioService } from "@/services/audioService";
import type { SoundType, AudioSettings } from "@/services/audioService";

const toast = useToast();

// State
const audioEnabled = ref(true);
const masterVolume = ref(0.7);
const notificationQueue = ref(true);
const priorityOverride = ref(true);
const maxQueueSize = ref(10);
const fadeOutTime = ref(500);
const isTesting = ref(false);

const soundSettings = reactive<
  Record<SoundType, { enabled: boolean; volume: number }>
>({
  newOrder: { enabled: true, volume: 0.8 },
  orderReady: { enabled: true, volume: 0.9 },
  orderUrgent: { enabled: true, volume: 1.0 },
  orderComplete: { enabled: true, volume: 0.6 },
  warning: { enabled: true, volume: 0.8 },
  success: { enabled: true, volume: 0.5 },
  error: { enabled: true, volume: 0.9 },
  notification: { enabled: true, volume: 0.6 },
  bell: { enabled: true, volume: 0.7 },
  chime: { enabled: true, volume: 0.5 },
});

// Sound categories for organization
const soundCategories = reactive({
  orders: {
    title: "訂單通知",
    icon: BellIcon,
    enabled: true,
    sounds: [
      "newOrder",
      "orderReady",
      "orderUrgent",
      "orderComplete",
    ] as SoundType[],
  },
  alerts: {
    title: "警告提示",
    icon: ExclamationTriangleIcon,
    enabled: true,
    sounds: ["warning", "error"] as SoundType[],
  },
  feedback: {
    title: "操作反饋",
    icon: CheckCircleIcon,
    enabled: true,
    sounds: ["success", "notification"] as SoundType[],
  },
  ambient: {
    title: "環境音效",
    icon: InformationCircleIcon,
    enabled: true,
    sounds: ["bell", "chime"] as SoundType[],
  },
});

// Methods
const getSoundLabel = (soundType: SoundType): string => {
  const labels: Record<string, string> = {
    newOrder: "新訂單",
    orderReady: "訂單準備完成",
    orderUrgent: "緊急訂單",
    orderComplete: "訂單完成",
    warning: "警告",
    success: "成功",
    error: "錯誤",
    notification: "通知",
    bell: "鈴聲",
    chime: "提示音",
  };
  return labels[soundType] || soundType;
};

const toggleAudio = () => {
  audioEnabled.value = !audioEnabled.value;

  if (audioEnabled.value) {
    audioService.enable();
    toast.success("音頻通知已啟用");
  } else {
    audioService.disable();
    toast.info("音頻通知已停用");
  }
};

const updateMasterVolume = () => {
  audioService.setMasterVolume(masterVolume.value);
};

const updateCategorySettings = (categoryKey: string) => {
  const category = (soundCategories as Record<string, any>)[categoryKey];
  // Enable/disable all sounds in category
  category.sounds.forEach((soundType: SoundType) => {
    soundSettings[soundType as keyof typeof soundSettings].enabled =
      category.enabled;
  });
  updateAllSoundSettings();
};

const updateSoundSettings = (soundType: SoundType) => {
  const settings = audioService.getSettings();
  settings.sounds[soundType] = { ...soundSettings[soundType] };
  audioService.updateSettings({ sounds: settings.sounds });
};

const updateAllSoundSettings = () => {
  const settings = audioService.getSettings();
  Object.keys(soundSettings).forEach((key) => {
    const soundType = key as SoundType;
    settings.sounds[soundType] = { ...soundSettings[soundType] };
  });
  audioService.updateSettings({ sounds: settings.sounds });
};

const updateAdvancedSettings = () => {
  audioService.updateSettings({
    notificationQueue: notificationQueue.value,
    priorityOverride: priorityOverride.value,
    maxQueueSize: maxQueueSize.value,
  });
};

const testSound = async (soundType: SoundType) => {
  if (!audioEnabled.value) return;

  try {
    await audioService.testSound(soundType);
    toast.success(`已播放 ${getSoundLabel(soundType)} 音效`);
  } catch (error: any) {
    toast.error(`播放音效失敗: ${error.message}`);
  }
};

const testAllSounds = async () => {
  if (!audioEnabled.value || isTesting.value) return;

  isTesting.value = true;

  try {
    await audioService.testAllSounds();
    toast.success("所有音效測試完成");
  } catch (error: any) {
    toast.error(`音效測試失敗: ${error.message}`);
  } finally {
    isTesting.value = false;
  }
};

const stopAllSounds = () => {
  audioService.stopAll();
  toast.info("已停止所有音效播放");
};

const resetToDefaults = () => {
  const defaultSettings = {
    masterVolume: 0.7,
    enabled: true,
    notificationQueue: true,
    priorityOverride: true,
    maxQueueSize: 10,
    sounds: {
      newOrder: { enabled: true, volume: 0.8 },
      orderReady: { enabled: true, volume: 0.9 },
      orderUrgent: { enabled: true, volume: 1.0 },
      orderComplete: { enabled: true, volume: 0.6 },
      warning: { enabled: true, volume: 0.8 },
      success: { enabled: true, volume: 0.5 },
      error: { enabled: true, volume: 0.9 },
      notification: { enabled: true, volume: 0.6 },
      bell: { enabled: true, volume: 0.7 },
      chime: { enabled: true, volume: 0.5 },
    },
  };

  // Update local state
  audioEnabled.value = defaultSettings.enabled;
  masterVolume.value = defaultSettings.masterVolume;
  notificationQueue.value = defaultSettings.notificationQueue;
  priorityOverride.value = defaultSettings.priorityOverride;
  maxQueueSize.value = defaultSettings.maxQueueSize;

  Object.assign(soundSettings, defaultSettings.sounds);

  // Update service
  audioService.updateSettings(defaultSettings);

  toast.success("已重設為預設音頻設置");
};

const saveSettings = () => {
  const settings: Partial<AudioSettings> = {
    masterVolume: masterVolume.value,
    enabled: audioEnabled.value,
    notificationQueue: notificationQueue.value,
    priorityOverride: priorityOverride.value,
    maxQueueSize: maxQueueSize.value,
    sounds: { ...soundSettings },
  };

  audioService.updateSettings(settings);
  toast.success("音頻設置已保存");
};

// Load current settings on mount
onMounted(() => {
  const currentSettings = audioService.getSettings();

  audioEnabled.value = currentSettings.enabled;
  masterVolume.value = currentSettings.masterVolume;
  notificationQueue.value = currentSettings.notificationQueue;
  priorityOverride.value = currentSettings.priorityOverride;
  maxQueueSize.value = currentSettings.maxQueueSize;

  Object.assign(soundSettings, currentSettings.sounds);
});
</script>

<style scoped>
/* Custom range slider styles */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 18px;
  width: 18px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #6366f1;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input[type="range"]::-moz-range-thumb {
  height: 18px;
  width: 18px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #6366f1;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input[type="range"]:disabled::-webkit-slider-thumb {
  opacity: 0.5;
  cursor: not-allowed;
}

input[type="range"]:disabled::-moz-range-thumb {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Spinner animation */
@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
