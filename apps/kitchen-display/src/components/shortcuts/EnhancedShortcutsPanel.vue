<template>
  <!-- Enhanced Keyboard Shortcuts Panel -->
  <div class="bg-white rounded-xl shadow-lg overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div
            class="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center"
          >
            <CommandLineIcon class="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-white">快捷鍵中心</h3>
            <p class="text-purple-100 text-sm">增強型鍵盤操控</p>
          </div>
        </div>

        <!-- Status indicators -->
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2 text-white">
            <div
              :class="[
                'w-2 h-2 rounded-full',
                shortcuts.enabled ? 'bg-green-400' : 'bg-red-400',
              ]"
            />
            <span class="text-sm">{{
              shortcuts.enabled ? "已啟用" : "已停用"
            }}</span>
          </div>

          <button
            :class="[
              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-purple-600',
              shortcuts.enabled ? 'bg-green-400' : 'bg-gray-300',
            ]"
            @click="toggleShortcuts"
          >
            <span
              :class="[
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                shortcuts.enabled ? 'translate-x-5' : 'translate-x-0',
              ]"
            />
          </button>
        </div>
      </div>
    </div>

    <div class="p-6 space-y-6">
      <!-- Quick Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-900">
            {{ shortcuts.enabledShortcuts.value?.length || 0 }}
          </div>
          <div class="text-sm text-gray-500">已啟用</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-900">
            {{ shortcuts.stats.value?.totalExecutions || 0 }}
          </div>
          <div class="text-sm text-gray-500">總使用次數</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-900">
            {{ Math.round(shortcuts.stats.value?.successRate || 0) }}%
          </div>
          <div class="text-sm text-gray-500">成功率</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-900">
            {{ Math.round(shortcuts.stats.value?.averageExecutionTime || 0) }}ms
          </div>
          <div class="text-sm text-gray-500">平均執行時間</div>
        </div>
      </div>

      <!-- Visual Feedback Settings -->
      <div class="bg-gray-50 rounded-lg p-4">
        <h4 class="text-sm font-medium text-gray-700 mb-3">視覺回饋設定</h4>
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600">啟用視覺提示</span>
          <input
            v-model="shortcuts.showVisualFeedback"
            type="checkbox"
            class="form-checkbox text-purple-600 rounded"
          />
        </div>
      </div>

      <!-- Category Tabs -->
      <div>
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex space-x-8">
            <button
              v-for="(category, categoryName) in shortcuts.shortcutsByCategory"
              :key="categoryName"
              :class="[
                'py-2 px-1 border-b-2 font-medium text-sm',
                activeCategory === String(categoryName)
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              ]"
              @click="activeCategory = String(categoryName)"
            >
              {{ getCategoryName(String(categoryName)) }}
              <span
                class="ml-1 bg-gray-100 text-gray-900 rounded-full px-2 py-1 text-xs"
              >
                {{
                  Array.isArray(category)
                    ? category.filter((s: any) => s.enabled).length
                    : 0
                }}
              </span>
            </button>
          </nav>
        </div>

        <!-- Shortcuts List -->
        <div class="mt-4 space-y-3">
          <div
            v-for="shortcut in shortcuts.shortcutsByCategory.value[
              activeCategory
            ]"
            :key="shortcut.id"
            class="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
          >
            <div class="flex items-center space-x-3">
              <!-- Visual indicator -->
              <div
                v-if="shortcut.visual"
                :class="[
                  'w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm',
                  getColorClass(shortcut.visual.color),
                ]"
              >
                {{ shortcut.visual.icon }}
              </div>
              <div
                v-else
                class="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center"
              >
                <CommandLineIcon class="w-4 h-4 text-gray-500" />
              </div>

              <div class="flex-1">
                <div class="flex items-center space-x-2">
                  <h4 class="text-sm font-medium text-gray-900">
                    {{ shortcut.name }}
                  </h4>
                  <span
                    v-if="shortcut.global"
                    class="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full"
                  >
                    全域
                  </span>
                  <span
                    v-if="shortcut.customizable"
                    class="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full"
                  >
                    可自訂
                  </span>
                </div>
                <p class="text-sm text-gray-600">
                  {{ shortcut.description }}
                </p>
              </div>
            </div>

            <div class="flex items-center space-x-3">
              <!-- Keyboard keys -->
              <div class="flex items-center space-x-1">
                <kbd
                  v-for="key in shortcut.keys"
                  :key="key"
                  class="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono"
                >
                  {{ formatKey(key) }}
                </kbd>
              </div>

              <!-- Actions -->
              <div class="flex items-center space-x-2">
                <!-- Test button -->
                <button
                  :disabled="!shortcuts.enabled"
                  class="p-1 text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                  title="測試快捷鍵"
                  @click="testShortcut(shortcut)"
                >
                  <PlayIcon class="w-4 h-4" />
                </button>

                <!-- Edit button for customizable shortcuts -->
                <button
                  v-if="shortcut.customizable"
                  class="p-1 text-gray-600 hover:text-gray-700"
                  title="編輯快捷鍵"
                  @click="editShortcut(shortcut)"
                >
                  <PencilIcon class="w-4 h-4" />
                </button>

                <!-- Enable/disable toggle -->
                <input
                  v-model="shortcut.enabled"
                  type="checkbox"
                  class="form-checkbox text-purple-600 rounded"
                  @change="updateShortcut(shortcut)"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Most Used Shortcuts -->
      <div v-if="shortcuts.stats.value.mostUsed?.length > 0">
        <h4 class="text-sm font-medium text-gray-700 mb-3">最常使用的快捷鍵</h4>
        <div class="space-y-2">
          <div
            v-for="usage in shortcuts.stats.value.mostUsed?.slice(0, 5) || []"
            :key="usage.shortcutId"
            class="flex items-center justify-between text-sm"
          >
            <span class="text-gray-600">{{
              getShortcutName(usage.shortcutId)
            }}</span>
            <div class="flex items-center space-x-2">
              <span class="text-gray-900 font-medium">{{ usage.count }}次</span>
              <div class="w-16 bg-gray-200 rounded-full h-1">
                <div
                  class="bg-purple-500 h-1 rounded-full"
                  :style="{
                    width: `${(usage.count / Math.max(...(shortcuts.stats.value.mostUsed?.map((u: any) => u.count) || [1]))) * 100}%`,
                  }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Executions -->
      <div v-if="shortcuts.stats.value.recentExecutions?.length > 0">
        <h4 class="text-sm font-medium text-gray-700 mb-3">最近執行記錄</h4>
        <div class="space-y-2 max-h-32 overflow-y-auto">
          <div
            v-for="execution in shortcuts.stats.value.recentExecutions || []"
            :key="execution.timestamp"
            class="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded p-2"
          >
            <span>{{ getShortcutName(execution.shortcutId) }}</span>
            <div class="flex items-center space-x-2">
              <span
                :class="execution.success ? 'text-green-600' : 'text-red-600'"
              >
                {{ execution.success ? "成功" : "失敗" }}
              </span>
              <span>{{ formatTime(execution.timestamp) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Custom Shortcut Creation -->
      <div class="border-t border-gray-200 pt-4">
        <div class="flex items-center justify-between mb-4">
          <h4 class="text-sm font-medium text-gray-700">自訂快捷鍵</h4>
          <button
            class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            @click="startCustomShortcut"
          >
            <PlusIcon class="w-4 h-4 mr-1" />
            新增
          </button>
        </div>

        <!-- Recording mode indicator -->
        <div
          v-if="shortcuts.recordingMode"
          class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4"
        >
          <div class="flex items-center">
            <div class="w-3 h-3 bg-red-500 rounded-full animate-pulse mr-2" />
            <span class="text-red-800 text-sm font-medium"
              >正在錄製快捷鍵組合...</span
            >
          </div>
          <div class="text-red-700 text-xs mt-1">
            按下想要的按鍵組合，完成後點擊停止
          </div>
          <button
            class="mt-2 text-red-600 hover:text-red-700 text-xs underline"
            @click="stopRecording"
          >
            停止錄製
          </button>
        </div>
      </div>

      <!-- Help Information -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 class="text-sm font-medium text-blue-900 mb-2 flex items-center">
          <InformationCircleIcon class="w-4 h-4 mr-2" />
          使用提示
        </h4>
        <ul class="text-sm text-blue-800 space-y-1">
          <li>• 快捷鍵在非輸入框區域有效</li>
          <li>• 全域快捷鍵在任何地方都能使用</li>
          <li>• 可以通過視覺回饋查看執行結果</li>
          <li>• 支援自訂快捷鍵和修改現有快捷鍵</li>
        </ul>
      </div>
    </div>

    <!-- Visual Feedback Overlay -->
    <div
      v-if="shortcuts.visualFeedback.value.show"
      :class="[
        'fixed z-50 pointer-events-none transform transition-all duration-500',
        getVisualFeedbackClass(),
      ]"
      :style="{
        left: `${shortcuts.visualFeedback.value.position.x}px`,
        top: `${shortcuts.visualFeedback.value.position.y}px`,
      }"
    >
      <div class="bg-white rounded-lg shadow-lg px-3 py-2 text-sm font-medium">
        {{ shortcuts.visualFeedback.value.message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  CommandLineIcon,
  PlayIcon,
  PencilIcon,
  PlusIcon,
  InformationCircleIcon,
} from "@heroicons/vue/24/outline";
import { useToast } from "vue-toastification";
import { useEnhancedKeyboardShortcuts } from "@/composables/useEnhancedKeyboardShortcuts";
import type { KeyboardShortcut } from "@/composables/useEnhancedKeyboardShortcuts";

const toast = useToast();
const shortcuts = useEnhancedKeyboardShortcuts();

// Local state
const activeCategory = ref("orders");

// Methods
const toggleShortcuts = () => {
  shortcuts.enabled.value = !shortcuts.enabled.value;
  toast.info(shortcuts.enabled.value ? "快捷鍵已啟用" : "快捷鍵已停用");
};

const getCategoryName = (category: string): string => {
  const names: Record<string, string> = {
    orders: "訂單操作",
    navigation: "導航功能",
    filters: "篩選功能",
    system: "系統功能",
    audio: "音效控制",
  };
  return names[category] || category;
};

const getColorClass = (color?: string): string => {
  const colors: Record<string, string> = {
    red: "bg-red-500",
    green: "bg-green-500",
    blue: "bg-blue-500",
    yellow: "bg-yellow-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    gray: "bg-gray-500",
  };
  return colors[color || "gray"] || "bg-gray-500";
};

const formatKey = (key: string): string => {
  const symbols: { [key: string]: string } = {
    Ctrl: "⌃",
    Cmd: "⌘",
    Alt: "⌥",
    Shift: "⇧",
    Space: "␣",
    Enter: "↵",
    Tab: "⇥",
    Escape: "Esc",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Home: "⌂",
    End: "⌁",
  };

  return symbols[key] || key;
};

const testShortcut = async (shortcut: KeyboardShortcut) => {
  try {
    const success = await shortcuts.executeShortcut(
      shortcut,
      new KeyboardEvent("keydown"),
    );
    toast[success ? "success" : "error"](
      `快捷鍵測試${success ? "成功" : "失敗"}: ${shortcut.name}`,
    );
  } catch (error) {
    toast.error("測試快捷鍵時發生錯誤");
  }
};

const editShortcut = (shortcut: KeyboardShortcut) => {
  // This would typically open an edit modal
  toast.info(`編輯快捷鍵: ${shortcut.name}`);
};

const updateShortcut = (shortcut: KeyboardShortcut) => {
  shortcuts.updateShortcut(shortcut.id, { enabled: shortcut.enabled });
  toast.success(
    `快捷鍵 ${shortcut.name} 已${shortcut.enabled ? "啟用" : "停用"}`,
  );
};

const getShortcutName = (shortcutId: string): string => {
  const shortcut = shortcuts.shortcuts.value.find((s) => s.id === shortcutId);
  return shortcut?.name || shortcutId;
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const startCustomShortcut = () => {
  shortcuts.startRecording();
};

const stopRecording = () => {
  const keys = shortcuts.stopRecording();
  if (keys.length > 0) {
    // This would typically open a dialog to complete the custom shortcut creation
    toast.success(`快捷鍵組合已錄製: ${keys.join(" + ")}`);
  }
};

const getVisualFeedbackClass = (): string => {
  const base = "animate-bounce";

  switch (shortcuts.visualFeedback.value.type) {
    case "success":
      return `${base} text-green-600`;
    case "error":
      return `${base} text-red-600`;
    default:
      return `${base} text-blue-600`;
  }
};
</script>

<style scoped>
/* Custom scrollbar */
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

/* Keyboard key styling */
kbd {
  font-family:
    ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo,
    monospace;
  font-weight: 600;
  font-size: 0.75rem;
  box-shadow:
    inset 0 -2px 0 0 #e5e7eb,
    inset 0 0 1px 1px #fff,
    0 1px 2px 1px rgba(0, 0, 0, 0.1);
}

/* Button hover effects */
button {
  transition: all 0.2s ease-in-out;
}

button:hover:not(:disabled) {
  transform: translateY(-1px);
}

button:active:not(:disabled) {
  transform: translateY(0);
}

/* Recording indicator pulse animation */
@keyframes pulse-red {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse {
  animation: pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>
