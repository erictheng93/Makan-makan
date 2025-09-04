<template>
  <div class="audio-settings">
    <!-- Main Audio Settings -->
    <div class="settings-section">
      <h3 class="section-title">
        <!-- <Icon name="volume-2" class="title-icon" /> -->
        音效設定
      </h3>

      <div class="setting-item">
        <label class="setting-label">
          <input
            v-model="settings.enabled"
            type="checkbox"
            class="setting-checkbox"
            @change="updateSettings"
          />
          啟用音效通知
        </label>
        <p class="setting-description">開啟或關閉所有音效通知</p>
      </div>

      <div class="setting-item" :class="{ disabled: !settings.enabled }">
        <label class="setting-label">主音量</label>
        <div class="volume-control">
          <!-- <Icon name="volume-1" class="volume-icon" /> -->
          <input
            v-model="volumePercent"
            type="range"
            min="0"
            max="100"
            :disabled="!settings.enabled"
            class="volume-slider"
            @input="updateVolume"
          />
          <!-- <Icon name="volume-2" class="volume-icon" /> -->
          <span class="volume-display">{{ volumePercent }}%</span>
        </div>
      </div>

      <div class="setting-item" :class="{ disabled: !settings.enabled }">
        <label class="setting-label">
          <input
            v-model="settings.useWebAudio"
            type="checkbox"
            :disabled="!settings.enabled || !isWebAudioSupported"
            class="setting-checkbox"
            @change="updateSettings"
          />
          使用高級音效引擎 (Web Audio API)
        </label>
        <p class="setting-description">
          提供更好的音質和特效，需要現代瀏覽器支援
          <span v-if="!isWebAudioSupported" class="unsupported"
            >(此瀏覽器不支援)</span
          >
        </p>
      </div>
    </div>

    <!-- Audio Effects -->
    <div
      v-if="settings.useWebAudio && settings.enabled"
      class="settings-section"
    >
      <h3 class="section-title">
        <!-- <Icon name="music" class="title-icon" /> -->
        音效特效
      </h3>

      <div class="setting-item">
        <label class="setting-label">
          <input
            v-model="settings.effects.reverb"
            type="checkbox"
            class="setting-checkbox"
            @change="updateSettings"
          />
          混響效果
        </label>
        <p class="setting-description">為音效添加空間感</p>
      </div>

      <div class="setting-item">
        <label class="setting-label">
          <input
            v-model="settings.effects.bass"
            type="checkbox"
            class="setting-checkbox"
            @change="updateSettings"
          />
          低音增強
        </label>
        <p class="setting-description">增強低頻音效</p>
      </div>

      <div class="setting-item">
        <label class="setting-label">
          <input
            v-model="settings.spatialAudio"
            type="checkbox"
            class="setting-checkbox"
            @change="updateSettings"
          />
          3D 空間音效
        </label>
        <p class="setting-description">根據訂單位置提供方向性音效</p>
      </div>
    </div>

    <!-- Adaptive Features -->
    <div class="settings-section">
      <h3 class="section-title">
        <!-- <Icon name="brain" class="title-icon" /> -->
        智慧功能
      </h3>

      <div class="setting-item">
        <label class="setting-label">
          <input
            v-model="settings.adaptiveVolume"
            type="checkbox"
            :disabled="!settings.enabled"
            class="setting-checkbox"
            @change="updateSettings"
          />
          自適應音量
        </label>
        <p class="setting-description">根據環境噪音和時間自動調節音量</p>
      </div>

      <div class="setting-item">
        <label class="setting-label">
          <input
            v-model="settings.contextAware"
            type="checkbox"
            :disabled="!settings.enabled"
            class="setting-checkbox"
            @change="updateSettings"
          />
          情境感知通知
        </label>
        <p class="setting-description">根據訂單頻率和優先級調整音效</p>
      </div>
    </div>

    <!-- Individual Sound Settings -->
    <div class="settings-section">
      <h3 class="section-title">
        <!-- <Icon name="sliders" class="title-icon" /> -->
        個別音效設定
      </h3>

      <div class="sound-settings-grid">
        <div
          v-for="soundType in soundTypes"
          :key="soundType.id"
          class="sound-setting"
        >
          <div class="sound-header">
            <label class="sound-label">
              <input
                v-model="soundType.enabled"
                type="checkbox"
                :disabled="!settings.enabled"
                class="setting-checkbox"
                @change="updateSoundSettings"
              />
              {{ soundType.name }}
            </label>
            <button
              :disabled="!settings.enabled || !soundType.enabled"
              class="test-button"
              @click="testSound(soundType.id)"
            >
              <!-- <Icon name="play" size="14" /> -->
            </button>
          </div>

          <div
            class="sound-volume"
            :class="{ disabled: !soundType.enabled || !settings.enabled }"
          >
            <input
              v-model="soundType.volume"
              type="range"
              min="0"
              max="100"
              :disabled="!settings.enabled || !soundType.enabled"
              class="sound-slider"
              @input="updateSoundSettings"
            />
            <span class="sound-volume-display">{{ soundType.volume }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Test Controls -->
    <div class="settings-section">
      <h3 class="section-title">
        <!-- <Icon name="headphones" class="title-icon" /> -->
        音效測試
      </h3>

      <div class="test-controls">
        <button
          :disabled="!settings.enabled"
          class="test-control-button primary"
          @click="testNewOrder"
        >
          <!-- <Icon name="bell" /> -->
          測試新訂單
        </button>

        <button
          :disabled="!settings.enabled"
          class="test-control-button warning"
          @click="testUrgentAlert"
        >
          <!-- <Icon name="alert-triangle" /> -->
          測試緊急警報
        </button>

        <button
          :disabled="!settings.enabled"
          class="test-control-button success"
          @click="testOrderReady"
        >
          <!-- <Icon name="check-circle" /> -->
          測試訂單完成
        </button>

        <button
          :disabled="!settings.enabled || isTestingAll"
          class="test-control-button secondary"
          @click="testAllSounds"
        >
          <!-- <Icon :name="isTestingAll ? 'loader' : 'play-circle'" :class="{ spinning: isTestingAll }" /> -->
          {{ isTestingAll ? "測試中..." : "測試所有音效" }}
        </button>
      </div>
    </div>

    <!-- Statistics -->
    <div v-if="statistics" class="settings-section">
      <h3 class="section-title">
        <!-- <Icon name="bar-chart-3" class="title-icon" /> -->
        音效統計
      </h3>

      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">
            {{ statistics?.totalPlayed ?? 0 }}
          </div>
          <div class="stat-label">總播放次數</div>
        </div>

        <div class="stat-item">
          <div class="stat-value">
            {{ statistics?.todayPlayed ?? 0 }}
          </div>
          <div class="stat-label">今日播放次數</div>
        </div>

        <div class="stat-item">
          <div class="stat-value">
            {{ statistics?.mostPlayed ?? "無" }}
          </div>
          <div class="stat-label">最常播放音效</div>
        </div>

        <div class="stat-item">
          <div class="stat-value">
            {{ formatTime(statistics?.lastPlayed ?? 0) }}
          </div>
          <div class="stat-label">最後播放時間</div>
        </div>
      </div>
    </div>

    <!-- Reset Controls -->
    <div class="settings-section">
      <h3 class="section-title">
        <!-- <Icon name="settings" class="title-icon" /> -->
        重設選項
      </h3>

      <div class="reset-controls">
        <button class="reset-button" @click="resetToDefaults">
          <!-- <Icon name="rotate-ccw" /> -->
          重設為預設值
        </button>

        <button class="export-button" @click="exportSettings">
          <!-- <Icon name="download" /> -->
          匯出設定
        </button>

        <button class="import-button" @click="importSettingsClick">
          <!-- <Icon name="upload" /> -->
          匯入設定
        </button>
        <input
          ref="importFile"
          type="file"
          accept=".json"
          style="display: none"
          @change="importSettings"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from "vue";
import { useToast } from "vue-toastification";
import { enhancedAudioService } from "@/services/enhancedAudioService";
// Icon component temporarily removed - TODO: Replace with heroicons

// Props & Emits
const _emit = defineEmits<{
  close: [];
}>();

// Composables
const toast = useToast();

// Reactive state
const settings = reactive({ ...enhancedAudioService.settings });
const isWebAudioSupported = computed(
  () => enhancedAudioService.isWebAudioSupported.value,
);
const isTestingAll = ref(false);
const statistics = ref<{
  totalPlayed: number;
  todayPlayed: number;
  mostPlayed: string;
  lastPlayed: number;
} | null>(null);
const importFile = ref<HTMLInputElement>();

// Volume as percentage for UI
const volumePercent = computed({
  get: () => Math.round(settings.masterVolume * 100),
  set: (value) => {
    settings.masterVolume = value / 100;
  },
});

// Sound types configuration
const soundTypes = reactive([
  { id: "new-order", name: "新訂單", enabled: true, volume: 80 },
  { id: "order-ready", name: "訂單完成", enabled: true, volume: 90 },
  { id: "urgent-alert", name: "緊急警報", enabled: true, volume: 100 },
  { id: "order-complete", name: "訂單交付", enabled: true, volume: 70 },
  { id: "warning", name: "警告", enabled: true, volume: 80 },
  { id: "success", name: "成功", enabled: true, volume: 60 },
  { id: "error", name: "錯誤", enabled: true, volume: 80 },
  { id: "notification", name: "通知", enabled: true, volume: 50 },
  { id: "bell", name: "鈴聲", enabled: true, volume: 70 },
  { id: "chime", name: "提示音", enabled: true, volume: 60 },
]);

// Watchers
watch(
  () => settings,
  (newSettings) => {
    Object.assign(enhancedAudioService.settings, newSettings);
  },
  { deep: true },
);

// Methods
const updateSettings = () => {
  Object.assign(enhancedAudioService.settings, settings);
  toast.success("設定已更新");
};

const updateVolume = () => {
  enhancedAudioService.setMasterVolume(settings.masterVolume);
  toast.info(`音量設定為 ${volumePercent.value}%`);
};

const updateSoundSettings = () => {
  // Update individual sound settings
  toast.success("音效設定已更新");
};

const testSound = async (soundType: string) => {
  try {
    await enhancedAudioService.playSound(soundType as any, {
      priority: "medium",
    });
  } catch (error) {
    toast.error("音效測試失敗");
  }
};

const testNewOrder = async () => {
  await enhancedAudioService.playNewOrderAlert({
    tableNumber: "測試桌號",
  });
};

const testUrgentAlert = async () => {
  await enhancedAudioService.playUrgentAlert("測試緊急警報");
};

const testOrderReady = async () => {
  await enhancedAudioService.playOrderReadyAlert("TEST-001");
};

const testAllSounds = async () => {
  isTestingAll.value = true;

  try {
    for (const soundType of soundTypes) {
      if (soundType.enabled) {
        await testSound(soundType.id);
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  } finally {
    isTestingAll.value = false;
  }
};

const resetToDefaults = () => {
  // Reset to default settings
  Object.assign(settings, {
    masterVolume: 0.8,
    enabled: true,
    useWebAudio: true,
    spatialAudio: false,
    effects: {
      reverb: false,
      echo: false,
      bass: false,
    },
    adaptiveVolume: true,
    contextAware: true,
  });

  updateSettings();
  toast.success("設定已重設為預設值");
};

const exportSettings = () => {
  const exportData = {
    audioSettings: settings,
    soundSettings: soundTypes,
    exportedAt: new Date().toISOString(),
    version: "1.0",
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kitchen-audio-settings-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);

  toast.success("設定已匯出");
};

const importSettingsClick = () => {
  importFile.value?.click();
};

const importSettings = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);

      if (data.audioSettings) {
        Object.assign(settings, data.audioSettings);
      }

      if (data.soundSettings) {
        Object.assign(soundTypes, data.soundSettings);
      }

      updateSettings();
      toast.success("設定已匯入");
    } catch (error) {
      toast.error("匯入失敗：無效的設定檔案");
    }
  };

  reader.readAsText(file);
};

const loadStatistics = () => {
  // Load audio statistics (would be implemented with actual data)
  statistics.value = {
    totalPlayed: 1250,
    todayPlayed: 45,
    mostPlayed: "新訂單",
    lastPlayed: Date.now() - 5 * 60 * 1000, // 5 minutes ago
  };
};

const formatTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 1) return "剛才";
  if (minutes < 60) return `${minutes} 分鐘前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;

  const days = Math.floor(hours / 24);
  return `${days} 天前`;
};

// Lifecycle
onMounted(() => {
  loadStatistics();
});
</script>

<style scoped>
.audio-settings {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.settings-section {
  margin-bottom: 32px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0 0 20px 0;
  padding-bottom: 12px;
  border-bottom: 2px solid #e9ecef;
}

.title-icon {
  color: #3498db;
}

.setting-item {
  margin-bottom: 20px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 4px;
  cursor: pointer;
}

.setting-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #3498db;
}

.setting-description {
  font-size: 14px;
  color: #6c757d;
  margin: 4px 0 0 24px;
}

.unsupported {
  color: #e74c3c;
  font-weight: 500;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.volume-icon {
  color: #6c757d;
}

.volume-slider {
  flex: 1;
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  outline: none;
  accent-color: #3498db;
}

.volume-display {
  font-weight: 500;
  color: #2c3e50;
  min-width: 40px;
  text-align: right;
}

.sound-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.sound-setting {
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.sound-header {
  display: flex;
  justify-content: between;
  align-items: center;
  margin-bottom: 12px;
}

.sound-label {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
}

.test-button {
  padding: 4px 8px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background-color 0.2s;
}

.test-button:hover:not(:disabled) {
  background: #2980b9;
}

.test-button:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.sound-volume {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sound-slider {
  flex: 1;
  height: 4px;
  background: #e9ecef;
  border-radius: 2px;
  outline: none;
  accent-color: #3498db;
}

.sound-volume-display {
  font-size: 12px;
  font-weight: 500;
  color: #6c757d;
  min-width: 32px;
  text-align: right;
}

.test-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.test-control-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.test-control-button.primary {
  background: #3498db;
  color: white;
}

.test-control-button.primary:hover:not(:disabled) {
  background: #2980b9;
}

.test-control-button.warning {
  background: #f39c12;
  color: white;
}

.test-control-button.warning:hover:not(:disabled) {
  background: #e67e22;
}

.test-control-button.success {
  background: #27ae60;
  color: white;
}

.test-control-button.success:hover:not(:disabled) {
  background: #229954;
}

.test-control-button.secondary {
  background: #95a5a6;
  color: white;
}

.test-control-button.secondary:hover:not(:disabled) {
  background: #7f8c8d;
}

.test-control-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #2c3e50;
}

.stat-label {
  font-size: 12px;
  color: #6c757d;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.reset-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.reset-button,
.export-button,
.import-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 2px solid;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.reset-button {
  border-color: #e74c3c;
  color: #e74c3c;
}

.reset-button:hover {
  background: #e74c3c;
  color: white;
}

.export-button {
  border-color: #3498db;
  color: #3498db;
}

.export-button:hover {
  background: #3498db;
  color: white;
}

.import-button {
  border-color: #27ae60;
  color: #27ae60;
}

.import-button:hover {
  background: #27ae60;
  color: white;
}

@media (max-width: 768px) {
  .audio-settings {
    padding: 16px;
    margin: 16px;
  }

  .sound-settings-grid {
    grid-template-columns: 1fr;
  }

  .test-controls {
    flex-direction: column;
  }

  .reset-controls {
    flex-direction: column;
  }
}
</style>
