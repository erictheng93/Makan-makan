<template>
  <!-- Interactive Audio Control Panel -->
  <div class="bg-white rounded-xl shadow-lg overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div
            class="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center"
          >
            <SpeakerWaveIcon class="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-white">音效控制中心</h3>
            <p class="text-blue-100 text-sm">互動式音效管理</p>
          </div>
        </div>

        <!-- Master Toggle -->
        <button
          :class="[
            'relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600',
            audioService.settings.enabled ? 'bg-green-400' : 'bg-gray-300',
          ]"
          @click="toggleAudio"
        >
          <span
            :class="[
              'pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
              audioService.settings.enabled ? 'translate-x-6' : 'translate-x-0',
            ]"
          />
        </button>
      </div>
    </div>

    <div class="p-6 space-y-6">
      <!-- Master Volume Control -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-3">
          主音量 ({{ Math.round(audioService.settings.masterVolume * 100) }}%)
        </label>
        <div class="flex items-center space-x-4">
          <SpeakerXMarkIcon class="w-5 h-5 text-gray-400" />
          <div class="flex-1">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              :value="audioService.settings.masterVolume"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              @input="
                setMasterVolume(($event.target as HTMLInputElement).value)
              "
            />
          </div>
          <SpeakerWaveIcon class="w-5 h-5 text-gray-600" />
        </div>
      </div>

      <!-- Audio Technology Selection -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-3"
          >音頻技術</label
        >
        <div class="flex items-center space-x-6">
          <label class="flex items-center">
            <input
              type="radio"
              :checked="audioService.settings.useWebAudio"
              class="form-radio text-blue-600"
              @change="setAudioTechnology(true)"
            />
            <span class="ml-2 text-sm text-gray-700">Web Audio API</span>
            <span
              v-if="audioService.isWebAudioSupported"
              class="ml-1 text-green-500"
              >✓</span
            >
            <span v-else class="ml-1 text-red-500">✗</span>
          </label>
          <label class="flex items-center">
            <input
              type="radio"
              :checked="!audioService.settings.useWebAudio"
              class="form-radio text-blue-600"
              @change="setAudioTechnology(false)"
            />
            <span class="ml-2 text-sm text-gray-700">Howler.js</span>
          </label>
        </div>
      </div>

      <!-- Advanced Audio Features -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-3"
          >進階功能</label
        >
        <div class="space-y-3">
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-700">空間音效</span>
            <input
              v-model="audioService.settings.spatialAudio"
              type="checkbox"
              class="form-checkbox text-blue-600 rounded"
            />
          </label>
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-700">自適應音量</span>
            <input
              v-model="audioService.settings.adaptiveVolume"
              type="checkbox"
              class="form-checkbox text-blue-600 rounded"
            />
          </label>
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-700">情境感知</span>
            <input
              v-model="audioService.settings.contextAware"
              type="checkbox"
              class="form-checkbox text-blue-600 rounded"
            />
          </label>
        </div>
      </div>

      <!-- Audio Effects -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-3"
          >音效處理</label
        >
        <div class="space-y-3">
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-700">混響效果</span>
            <input
              v-model="audioService.settings.effects.reverb"
              type="checkbox"
              class="form-checkbox text-blue-600 rounded"
              @change="toggleEffect('reverb')"
            />
          </label>
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-700">回音效果</span>
            <input
              v-model="audioService.settings.effects.echo"
              type="checkbox"
              class="form-checkbox text-blue-600 rounded"
              @change="toggleEffect('echo')"
            />
          </label>
          <label class="flex items-center justify-between">
            <span class="text-sm text-gray-700">低音增強</span>
            <input
              v-model="audioService.settings.effects.bass"
              type="checkbox"
              class="form-checkbox text-blue-600 rounded"
              @change="toggleEffect('bass')"
            />
          </label>
        </div>
      </div>

      <!-- Sound Testing -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-4"
          >音效測試</label
        >
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            v-for="sound in availableSounds"
            :key="sound.type"
            :disabled="!audioService.settings.enabled"
            class="flex flex-col items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            @click="testSound(sound.type)"
          >
            <component :is="sound.icon" class="w-6 h-6 text-gray-600 mb-2" />
            <span class="text-xs text-gray-600">{{ sound.name }}</span>
          </button>
        </div>
      </div>

      <!-- Quick Actions -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-4"
          >快速操作</label
        >
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            :disabled="!audioService.settings.enabled"
            class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="testNewOrder"
          >
            <PlusIcon class="w-4 h-4 mr-2" />
            新訂單
          </button>

          <button
            :disabled="!audioService.settings.enabled"
            class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="testUrgentAlert"
          >
            <ExclamationTriangleIcon class="w-4 h-4 mr-2" />
            緊急警報
          </button>

          <button
            :disabled="!audioService.settings.enabled"
            class="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            @click="testOrderReady"
          >
            <CheckIcon class="w-4 h-4 mr-2" />
            訂單完成
          </button>
        </div>
      </div>

      <!-- Sound History -->
      <div v-if="audioService.soundHistory.value.length > 0">
        <label class="block text-sm font-medium text-gray-700 mb-3"
          >最近播放</label
        >
        <div class="max-h-32 overflow-y-auto space-y-2">
          <div
            v-for="event in audioService.soundHistory.value.slice(0, 5)"
            :key="event.id"
            class="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded p-2"
          >
            <span>{{ getSoundDisplayName(event.type) }}</span>
            <span>{{ formatTime(event.timestamp) }}</span>
          </div>
        </div>
      </div>

      <!-- Current Status -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h4 class="text-sm font-medium text-gray-700 mb-2">系統狀態</h4>
        <div class="space-y-2 text-xs">
          <div class="flex justify-between">
            <span>音頻系統:</span>
            <span
              :class="
                audioService.isInitialized ? 'text-green-600' : 'text-red-600'
              "
            >
              {{ audioService.isInitialized ? "已初始化" : "未初始化" }}
            </span>
          </div>
          <div class="flex justify-between">
            <span>Web Audio 支援:</span>
            <span
              :class="
                audioService.isWebAudioSupported
                  ? 'text-green-600'
                  : 'text-red-600'
              "
            >
              {{ audioService.isWebAudioSupported ? "支援" : "不支援" }}
            </span>
          </div>
          <div class="flex justify-between">
            <span>正在播放:</span>
            <span class="text-blue-600"
              >{{ audioService.currentlyPlaying.value.length }} 個音效</span
            >
          </div>
        </div>
      </div>

      <!-- Keyboard Shortcuts Info -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <h4 class="text-sm font-medium text-blue-900 mb-2">鍵盤快捷鍵</h4>
        <div class="text-xs text-blue-800 space-y-1">
          <div>
            <kbd class="px-1 py-0.5 bg-white rounded text-xs">Ctrl+Shift+N</kbd>
            測試新訂單
          </div>
          <div>
            <kbd class="px-1 py-0.5 bg-white rounded text-xs">Ctrl+Shift+U</kbd>
            測試緊急警報
          </div>
          <div>
            <kbd class="px-1 py-0.5 bg-white rounded text-xs">Ctrl+Shift+R</kbd>
            測試訂單完成
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CheckIcon,
  BellIcon,
  MusicalNoteIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/vue/24/outline";
import { useToast } from "vue-toastification";
import { enhancedAudioService } from "@/services/enhancedAudioService";
import type { SoundType } from "@/services/enhancedAudioService";

const toast = useToast();
const audioService = enhancedAudioService;

// Available sounds for testing
const availableSounds = computed(() => [
  { type: "new-order" as SoundType, name: "新訂單", icon: PlusIcon },
  { type: "order-ready" as SoundType, name: "訂單就緒", icon: CheckCircleIcon },
  {
    type: "urgent-alert" as SoundType,
    name: "緊急警報",
    icon: ExclamationTriangleIcon,
  },
  { type: "order-complete" as SoundType, name: "訂單完成", icon: CheckIcon },
  { type: "warning" as SoundType, name: "警告", icon: ExclamationCircleIcon },
  { type: "success" as SoundType, name: "成功", icon: CheckCircleIcon },
  { type: "error" as SoundType, name: "錯誤", icon: XCircleIcon },
  {
    type: "notification" as SoundType,
    name: "通知",
    icon: InformationCircleIcon,
  },
  { type: "bell" as SoundType, name: "鈴聲", icon: BellIcon },
  { type: "chime" as SoundType, name: "提示音", icon: MusicalNoteIcon },
]);

// Methods
const toggleAudio = () => {
  audioService.toggleEnabled();
  toast.info(audioService.settings.enabled ? "音效已啟用" : "音效已停用");
};

const setMasterVolume = (volume: string) => {
  audioService.setMasterVolume(parseFloat(volume));
};

const setAudioTechnology = (useWebAudio: boolean) => {
  audioService.settings.useWebAudio = useWebAudio;
  toast.info(useWebAudio ? "已切換至 Web Audio API" : "已切換至 Howler.js");
};

const toggleEffect = (effect: "reverb" | "echo" | "bass") => {
  toast.info(
    `${effect} 效果已${audioService.settings.effects[effect] ? "啟用" : "停用"}`,
  );
};

const testSound = async (type: SoundType) => {
  await audioService.playSound(type, {
    volume: 0.8,
    priority: "medium",
  });
};

const testNewOrder = async () => {
  await audioService.playNewOrderAlert({
    tableNumber: "T5",
    priority: "high",
  });
};

const testUrgentAlert = async () => {
  await audioService.playUrgentAlert("測試緊急警報！");
};

const testOrderReady = async () => {
  await audioService.playOrderReadyAlert("ORD-001");
};

const getSoundDisplayName = (type: SoundType): string => {
  const names = {
    "new-order": "新訂單",
    "order-ready": "訂單就緒",
    "urgent-alert": "緊急警報",
    "order-complete": "訂單完成",
    warning: "警告",
    success: "成功",
    error: "錯誤",
    notification: "通知",
    bell: "鈴聲",
    chime: "提示音",
    tick: "滴答",
    whoosh: "嗖聲",
  };
  return names[type] || type;
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

// Initialize audio service on component mount
if (!audioService.isInitialized.value) {
  audioService.initialize().catch((error) => {
    console.error("Failed to initialize audio service:", error);
    toast.error("音效系統初始化失敗");
  });
}
</script>

<style scoped>
/* Custom slider styling */
.slider::-webkit-slider-thumb {
  @apply appearance-none w-5 h-5 bg-blue-600 rounded-full cursor-pointer;
}

.slider::-moz-range-thumb {
  @apply w-5 h-5 bg-blue-600 rounded-full cursor-pointer border-0;
}

/* Keyboard shortcuts styling */
kbd {
  font-family:
    ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo,
    monospace;
}

/* Custom scrollbar for sound history */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 2px;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Animation for buttons */
button {
  transition: all 0.2s ease-in-out;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

button:active:not(:disabled) {
  transform: translateY(0);
}
</style>
