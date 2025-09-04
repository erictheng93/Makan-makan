<template>
  <div class="keyboard-feedback-container">
    <!-- Shortcut Help Overlay -->
    <Teleport to="body">
      <div v-if="showHelp" class="shortcut-help-overlay" @click="hideHelp">
        <div class="shortcut-help-panel" @click.stop>
          <div class="help-header">
            <h2>鍵盤快捷鍵</h2>
            <button class="close-button" @click="hideHelp">
              <!-- <Icon name="x" size="20" /> -->
            </button>
          </div>

          <div class="shortcut-groups">
            <div
              v-for="group in shortcutGroups"
              :key="group.category"
              class="shortcut-group"
            >
              <h3 class="group-title">
                {{ group.title }}
              </h3>
              <div class="shortcuts-list">
                <div
                  v-for="shortcut in group.shortcuts"
                  :key="shortcut.id"
                  class="shortcut-item"
                  :class="{ disabled: !shortcut.enabled }"
                >
                  <div class="shortcut-keys">
                    <kbd v-for="key in shortcut.keys" :key="key" class="key">
                      {{ formatKey(key) }}
                    </kbd>
                  </div>
                  <div class="shortcut-info">
                    <div class="shortcut-name">
                      {{ shortcut.name }}
                    </div>
                    <div class="shortcut-description">
                      {{ shortcut.description }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="help-footer">
          <p>按 <kbd>?</kbd> 或 <kbd>Esc</kbd> 關閉此幫助</p>
        </div>
      </div>
    </Teleport>
  </div>

  <!-- Action Feedback Toast -->
  <Teleport to="body">
    <Transition name="feedback-toast">
      <div
        v-if="showActionFeedback"
        class="action-feedback-toast"
        :class="actionFeedback.type"
      >
        <!-- <Icon :name="actionFeedback.icon" class="feedback-icon" /> -->
        <span class="feedback-text">{{ actionFeedback.text }}</span>
        <div class="feedback-shortcut">
          <kbd
            v-for="key in actionFeedback.keys"
            :key="key"
            class="feedback-key"
          >
            {{ formatKey(key) }}
          </kbd>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Key Press Visualization -->
  <div v-if="showKeyPresses && activeKeys.size > 0" class="key-press-display">
    <div class="pressed-keys">
      <kbd v-for="key in activeKeys" :key="key" class="pressed-key">
        {{ formatKey(key) }}
      </kbd>
    </div>
  </div>

  <!-- Shortcut Status Bar -->
  <div v-if="showStatusBar" class="shortcut-status-bar">
    <div class="status-section">
      <!-- <Icon name="keyboard" size="16" /> -->
      <span>快捷鍵: {{ enabled ? "啟用" : "停用" }}</span>
    </div>

    <div class="status-section">
      <!-- <Icon name="zap" size="16" /> -->
      <span>最後動作: {{ lastActionName || "無" }}</span>
    </div>

    <div class="status-section actions">
      <button
        class="status-button"
        :class="{ active: enabled }"
        @click="toggleEnabled"
      >
        <!-- <Icon :name="enabled ? 'toggle-right' : 'toggle-left'" size="14" /> -->
      </button>

      <button class="status-button" @click="toggleHelp">
        <!-- <Icon name="help-circle" size="14" /> -->
      </button>
    </div>
  </div>

  <!-- Contextual Hints -->
  <Transition name="hint-fade">
    <div
      v-if="contextHint && showContextHints"
      class="context-hint"
      :class="contextHint.type"
    >
      <!-- <Icon :name="contextHint.icon" class="hint-icon" /> -->
      <div class="hint-content">
        <div class="hint-text">
          {{ contextHint.text }}
        </div>
        <div class="hint-shortcut">
          <kbd v-for="key in contextHint.keys" :key="key" class="hint-key">
            {{ formatKey(key) }}
          </kbd>
        </div>
      </div>
      <button class="hint-dismiss" @click="dismissHint">
        <!-- <Icon name="x" size="14" /> -->
      </button>
    </div>
  </Transition>

  <!-- Shortcut Learning Mode -->
  <div v-if="learningMode" class="learning-overlay">
    <div class="learning-panel">
      <h3>學習模式</h3>
      <p>按下任意鍵盤組合來查看對應的快捷鍵功能</p>

      <div v-if="learningKeys.length > 0" class="learning-current">
        <div class="learning-keys">
          <kbd v-for="key in learningKeys" :key="key" class="learning-key">
            {{ formatKey(key) }}
          </kbd>
        </div>

        <div v-if="learningMatch" class="learning-match">
          <!-- <Icon name="check-circle" class="match-icon" /> -->
          <div class="match-info">
            <div class="match-name">
              {{ learningMatch.name }}
            </div>
            <div class="match-description">
              {{ learningMatch.description }}
            </div>
          </div>
        </div>
      </div>

      <div v-else class="learning-no-match">
        <!-- <Icon name="minus-circle" class="no-match-icon" /> -->
        <span>此組合鍵未設定快捷鍵</span>
      </div>
    </div>

    <div class="learning-controls">
      <button class="learning-exit" @click="exitLearningMode">
        退出學習模式
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";
import {
  useKeyboardShortcuts,
  type KeyboardShortcut,
} from "@/composables/useKeyboardShortcuts";
// Icon component temporarily removed - TODO: Replace with heroicons

// Composables
const {
  shortcuts,
  enabled,
  showHelp,
  activeKeys,
  actionQueue,
  shortcutGroups,
  toggleHelp,
  hideHelp,
  toggle: toggleEnabled,
} = useKeyboardShortcuts();

// Props
interface Props {
  showStatusBar?: boolean;
  showKeyPresses?: boolean;
  showContextHints?: boolean;
  enableLearningMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showStatusBar: true,
  showKeyPresses: true,
  showContextHints: true,
  enableLearningMode: false,
});

// State
const showActionFeedback = ref(false);
const actionFeedback = reactive({
  type: "success",
  icon: "check",
  text: "",
  keys: [] as string[],
});

const contextHint = ref<{
  type: string;
  icon: string;
  text: string;
  keys: string[];
} | null>(null);

const learningMode = ref(false);
const learningKeys = ref<string[]>([]);
const learningMatch = ref<KeyboardShortcut | null>(null);

// Computed
const lastActionName = computed(() => {
  if (actionQueue.value.length === 0) return null;

  const lastAction = actionQueue.value[actionQueue.value.length - 1];
  const shortcut = shortcuts.value.find((s) => s.action === lastAction);
  return shortcut?.name || lastAction;
});

// Methods
const formatKey = (key: string): string => {
  const keyMap: Record<string, string> = {
    Space: "␣",
    Enter: "↵",
    Tab: "⇥",
    Escape: "⎋",
    Backspace: "⌫",
    Delete: "⌦",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Ctrl: "⌃",
    Cmd: "⌘",
    Alt: "⌥",
    Shift: "⇧",
  };
  return keyMap[key] || key.toUpperCase();
};

const showActionFeedbackMessage = (action: string, type = "success") => {
  const shortcut = shortcuts.value.find((s) => s.action === action);
  if (!shortcut) return;

  actionFeedback.type = type;
  actionFeedback.icon = getActionIcon(action, type);
  actionFeedback.text = shortcut.name;
  actionFeedback.keys = shortcut.keys;

  showActionFeedback.value = true;

  setTimeout(() => {
    showActionFeedback.value = false;
  }, 2000);
};

const getActionIcon = (action: string, type: string): string => {
  if (type === "error") return "x-circle";
  if (type === "warning") return "alert-triangle";

  const actionIcons: Record<string, string> = {
    quick_complete: "check-circle",
    toggle_order_status: "refresh-cw",
    toggle_fullscreen: "maximize",
    toggle_audio: "volume-2",
    refresh_orders: "refresh-cw",
    show_shortcuts: "help-circle",
  };

  return actionIcons[action] || "check";
};

const showContextHint = (
  text: string,
  keys: string[],
  type = "info",
  icon = "info",
) => {
  if (!props.showContextHints) return;

  contextHint.value = {
    type,
    icon,
    text,
    keys,
  };

  // Auto dismiss after 5 seconds
  setTimeout(() => {
    if (contextHint.value && contextHint.value.text === text) {
      contextHint.value = null;
    }
  }, 5000);
};

const dismissHint = () => {
  contextHint.value = null;
};

const enterLearningMode = () => {
  if (!props.enableLearningMode) return;

  learningMode.value = true;
  learningKeys.value = [];
  learningMatch.value = null;
};

const exitLearningMode = () => {
  learningMode.value = false;
  learningKeys.value = [];
  learningMatch.value = null;
};

const updateLearningKeys = (keys: string[]) => {
  learningKeys.value = [...keys];

  // Find matching shortcut
  const match = shortcuts.value.find((shortcut) => {
    return (
      shortcut.keys.length === keys.length &&
      shortcut.keys.every((key) => keys.includes(key))
    );
  });

  learningMatch.value = match || null;
};

// Context-aware hints based on current state
const checkContextualHints = () => {
  // Example contextual hints
  const currentHour = new Date().getHours();

  if (currentHour >= 11 && currentHour <= 14) {
    // Lunch rush hints
    setTimeout(() => {
      showContextHint(
        "午餐時間到了！按空格鍵快速完成訂單",
        ["Space"],
        "info",
        "clock",
      );
    }, 5000);
  }

  if (currentHour >= 18 && currentHour <= 21) {
    // Dinner rush hints
    setTimeout(() => {
      showContextHint(
        "晚餐繁忙時段，按 M 切換音效提醒",
        ["M"],
        "warning",
        "volume-2",
      );
    }, 3000);
  }
};

// Event listeners for learning mode
const handleLearningKeyDown = (event: KeyboardEvent) => {
  if (!learningMode.value) return;

  const keys = [];
  if (event.ctrlKey) keys.push("Ctrl");
  if (event.altKey) keys.push("Alt");
  if (event.shiftKey) keys.push("Shift");
  if (event.metaKey) keys.push("Cmd");

  const key = event.key === " " ? "Space" : event.key;
  if (!keys.includes(key) && key.length === 1) {
    keys.push(key);
  }

  updateLearningKeys(keys);
};

const handleLearningKeyUp = () => {
  if (learningMode.value) {
    learningKeys.value = [];
    learningMatch.value = null;
  }
};

// Watchers
watch(
  () => actionQueue.value,
  (newQueue, oldQueue) => {
    if (newQueue.length > (oldQueue?.length || 0)) {
      const lastAction = newQueue[newQueue.length - 1];
      showActionFeedbackMessage(lastAction);
    }
  },
  { deep: true },
);

// Lifecycle
onMounted(() => {
  checkContextualHints();

  if (props.enableLearningMode) {
    document.addEventListener("keydown", handleLearningKeyDown);
    document.addEventListener("keyup", handleLearningKeyUp);
  }
});

onUnmounted(() => {
  if (props.enableLearningMode) {
    document.removeEventListener("keydown", handleLearningKeyDown);
    document.removeEventListener("keyup", handleLearningKeyUp);
  }
});

// Expose methods for parent components
defineExpose({
  showActionFeedbackMessage,
  showContextHint,
  enterLearningMode,
  exitLearningMode,
});
</script>

<style scoped>
.keyboard-feedback-container {
  position: relative;
}

/* Shortcut Help Overlay */
.shortcut-help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.shortcut-help-panel {
  background: white;
  border-radius: 12px;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.help-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 16px;
  border-bottom: 1px solid #e9ecef;
}

.help-header h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 24px;
}

.close-button {
  padding: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: #6c757d;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.close-button:hover {
  background: #f8f9fa;
}

.shortcut-groups {
  padding: 20px;
}

.shortcut-group {
  margin-bottom: 32px;
}

.shortcut-group:last-child {
  margin-bottom: 0;
}

.group-title {
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid #3498db;
}

.shortcuts-list {
  display: grid;
  gap: 12px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  transition: all 0.2s;
}

.shortcut-item:hover {
  background: #e9ecef;
}

.shortcut-item.disabled {
  opacity: 0.5;
}

.shortcut-keys {
  display: flex;
  gap: 4px;
  margin-right: 16px;
  min-width: 100px;
}

.key {
  padding: 4px 8px;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #495057;
  text-align: center;
  min-width: 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.shortcut-info {
  flex: 1;
}

.shortcut-name {
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 2px;
}

.shortcut-description {
  font-size: 14px;
  color: #6c757d;
}

.help-footer {
  padding: 16px 24px;
  border-top: 1px solid #e9ecef;
  text-align: center;
  color: #6c757d;
  font-size: 14px;
}

/* Action Feedback Toast */
.action-feedback-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  max-width: 300px;
  border-left: 4px solid #27ae60;
}

.action-feedback-toast.error {
  border-left-color: #e74c3c;
}

.action-feedback-toast.warning {
  border-left-color: #f39c12;
}

.feedback-icon {
  color: #27ae60;
}

.action-feedback-toast.error .feedback-icon {
  color: #e74c3c;
}

.action-feedback-toast.warning .feedback-icon {
  color: #f39c12;
}

.feedback-text {
  font-weight: 500;
  color: #2c3e50;
  flex: 1;
}

.feedback-shortcut {
  display: flex;
  gap: 2px;
}

.feedback-key {
  padding: 2px 6px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  color: #6c757d;
}

/* Key Press Display */
.key-press-display {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9998;
}

.pressed-keys {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  backdrop-filter: blur(8px);
}

.pressed-key {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: 600;
  min-width: 24px;
  text-align: center;
}

/* Shortcut Status Bar */
.shortcut-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
  font-size: 12px;
  color: #6c757d;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-section.actions {
  gap: 8px;
}

.status-button {
  padding: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: #6c757d;
  border-radius: 3px;
  transition: all 0.2s;
}

.status-button:hover {
  background: #e9ecef;
  color: #495057;
}

.status-button.active {
  color: #3498db;
}

/* Context Hint */
.context-hint {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: 9997;
  max-width: 400px;
  border-left: 4px solid #3498db;
}

.context-hint.warning {
  border-left-color: #f39c12;
}

.context-hint.error {
  border-left-color: #e74c3c;
}

.hint-icon {
  color: #3498db;
}

.context-hint.warning .hint-icon {
  color: #f39c12;
}

.context-hint.error .hint-icon {
  color: #e74c3c;
}

.hint-content {
  flex: 1;
}

.hint-text {
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 4px;
}

.hint-shortcut {
  display: flex;
  gap: 2px;
}

.hint-key {
  padding: 2px 6px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  color: #6c757d;
}

.hint-dismiss {
  padding: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: #6c757d;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.hint-dismiss:hover {
  background: #f8f9fa;
}

/* Learning Mode */
.learning-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.learning-panel {
  background: white;
  border-radius: 12px;
  padding: 32px;
  max-width: 500px;
  text-align: center;
}

.learning-panel h3 {
  margin: 0 0 16px 0;
  color: #2c3e50;
  font-size: 24px;
}

.learning-panel p {
  color: #6c757d;
  margin-bottom: 24px;
}

.learning-current {
  margin-bottom: 24px;
}

.learning-keys {
  display: flex;
  justify-content: center;
  gap: 4px;
  margin-bottom: 16px;
}

.learning-key {
  padding: 8px 16px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  min-width: 32px;
}

.learning-match,
.learning-no-match {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 6px;
}

.learning-match {
  background: #d4edda;
  color: #155724;
}

.learning-no-match {
  background: #f8d7da;
  color: #721c24;
}

.match-info {
  text-align: left;
}

.match-name {
  font-weight: 600;
}

.match-description {
  font-size: 12px;
  opacity: 0.8;
}

.learning-exit {
  padding: 10px 20px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.learning-exit:hover {
  background: #5a6268;
}

/* Transitions */
.feedback-toast-enter-active,
.feedback-toast-leave-active {
  transition: all 0.3s ease;
}

.feedback-toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.feedback-toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.hint-fade-enter-active,
.hint-fade-leave-active {
  transition: all 0.3s ease;
}

.hint-fade-enter-from,
.hint-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -40%);
}

@media (max-width: 768px) {
  .shortcut-help-panel {
    margin: 20px;
    max-height: calc(100vh - 40px);
  }

  .action-feedback-toast {
    left: 20px;
    right: 20px;
    max-width: none;
  }

  .context-hint {
    left: 20px;
    right: 20px;
    transform: translateY(-50%);
    max-width: none;
  }

  .learning-panel {
    margin: 20px;
    padding: 24px;
  }
}
</style>
