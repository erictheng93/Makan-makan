// Audio Accessibility Service - Comprehensive accessibility features for kitchen display audio
import { ref, reactive } from "vue";
import { enhancedAudioService } from "./enhancedAudioService";
import type { SoundType } from "./enhancedAudioService";

export interface AccessibilitySettings {
  // Visual alternatives
  visualNotifications: boolean;
  flashScreen: boolean;
  showSubtitles: boolean;
  highContrast: boolean;

  // Audio adjustments
  hearingAidMode: boolean;
  frequencyAdjustment: "none" | "bass-boost" | "treble-boost" | "mid-boost";
  slowSpeech: boolean;
  speechRate: number; // 0.5 to 2.0

  // Motor accessibility
  extendedKeyboardShortcuts: boolean;
  voiceCommands: boolean;
  eyeTracking: boolean;

  // Cognitive accessibility
  simplifiedInterface: boolean;
  reducedAnimations: boolean;
  consistentSounds: boolean;
  explanatoryAudio: boolean;

  // Customization
  personalizedSounds: boolean;
  culturalSounds: boolean;
  languagePreference: "zh-TW" | "zh-CN" | "en" | "th" | "vi" | "id";
}

export interface VisualAlert {
  id: string;
  type: "flash" | "border" | "overlay" | "icon";
  color: string;
  duration: number;
  intensity: number;
  message?: string;
}

export interface SubtitleEntry {
  id: string;
  text: string;
  timestamp: number;
  duration: number;
  type: "notification" | "system" | "order";
  language: string;
}

class AudioAccessibilityService {
  // Settings management
  public settings = reactive<AccessibilitySettings>({
    visualNotifications: false,
    flashScreen: false,
    showSubtitles: false,
    highContrast: false,
    hearingAidMode: false,
    frequencyAdjustment: "none",
    slowSpeech: false,
    speechRate: 1.0,
    extendedKeyboardShortcuts: false,
    voiceCommands: false,
    eyeTracking: false,
    simplifiedInterface: false,
    reducedAnimations: false,
    consistentSounds: true,
    explanatoryAudio: false,
    personalizedSounds: false,
    culturalSounds: false,
    languagePreference: "zh-TW",
  });

  // Visual alerts state
  public activeVisualAlerts = ref<VisualAlert[]>([]);
  public subtitles = ref<SubtitleEntry[]>([]);

  // Speech synthesis
  private speechSynth: SpeechSynthesis | null = null;
  private availableVoices = ref<SpeechSynthesisVoice[]>([]);

  // Voice recognition
  private speechRecognition: any = null;
  private isListening = ref(false);

  // Screen reader compatibility
  private announcements = ref<string[]>([]);

  // Sound customization
  private personalSounds = reactive<Map<SoundType, string>>(new Map());
  private culturalSoundPacks = reactive<Map<string, Record<SoundType, string>>>(
    new Map(),
  );

  constructor() {
    this.initializeSpeechSynthesis();
    this.initializeSpeechRecognition();
    this.setupCulturalSounds();
    this.loadSettings();
  }

  // Initialization methods
  private initializeSpeechSynthesis(): void {
    if ("speechSynthesis" in window) {
      this.speechSynth = window.speechSynthesis;

      // Load available voices
      const loadVoices = () => {
        this.availableVoices.value = this.speechSynth!.getVoices();
      };

      loadVoices();
      this.speechSynth.onvoiceschanged = loadVoices;
    }
  }

  private initializeSpeechRecognition(): void {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      this.speechRecognition = new SpeechRecognition();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = false;
      this.speechRecognition.lang = this.getLanguageCode();

      this.speechRecognition.onresult = (event: any) => {
        const transcript =
          event.results[event.results.length - 1][0].transcript.trim();
        this.processVoiceCommand(transcript);
      };

      this.speechRecognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        this.isListening.value = false;
      };
    }
  }

  private setupCulturalSounds(): void {
    // Traditional Chinese sounds
    this.culturalSoundPacks.set("zh-TW", {
      "new-order": "/sounds/cultural/zh-tw/gong.mp3",
      "order-ready": "/sounds/cultural/zh-tw/bell.mp3",
      "urgent-alert": "/sounds/cultural/zh-tw/urgent-gong.mp3",
      "order-complete": "/sounds/cultural/zh-tw/chime.mp3",
      warning: "/sounds/cultural/zh-tw/warning-bell.mp3",
      success: "/sounds/cultural/zh-tw/success-chime.mp3",
      error: "/sounds/cultural/zh-tw/error-gong.mp3",
      notification: "/sounds/cultural/zh-tw/soft-bell.mp3",
      bell: "/sounds/cultural/zh-tw/temple-bell.mp3",
      chime: "/sounds/cultural/zh-tw/wind-chime.mp3",
      tick: "/sounds/cultural/zh-tw/bamboo-click.mp3",
      whoosh: "/sounds/cultural/zh-tw/bamboo-whoosh.mp3",
    });

    // Thai sounds
    this.culturalSoundPacks.set("th", {
      "new-order": "/sounds/cultural/th/temple-bell.mp3",
      "order-ready": "/sounds/cultural/th/singing-bowl.mp3",
      "urgent-alert": "/sounds/cultural/th/urgent-gong.mp3",
      "order-complete": "/sounds/cultural/th/completion-chime.mp3",
      warning: "/sounds/cultural/th/warning-bell.mp3",
      success: "/sounds/cultural/th/success-bell.mp3",
      error: "/sounds/cultural/th/error-gong.mp3",
      notification: "/sounds/cultural/th/soft-chime.mp3",
      bell: "/sounds/cultural/th/temple-bell-large.mp3",
      chime: "/sounds/cultural/th/crystal-bowl.mp3",
      tick: "/sounds/cultural/th/bamboo-knock.mp3",
      whoosh: "/sounds/cultural/th/wind-chime.mp3",
    });

    // Additional cultural packs can be added here
  }

  // Main accessibility notification method
  async playAccessibleNotification(
    soundType: SoundType,
    message?: string,
    options?: {
      urgent?: boolean;
      skipAudio?: boolean;
      customVisual?: Partial<VisualAlert>;
      subtitle?: string;
    },
  ): Promise<void> {
    const isUrgent = options?.urgent || false;

    // Play audio (with accessibility adjustments)
    if (!options?.skipAudio) {
      await this.playAccessibleAudio(soundType, { urgent: isUrgent });
    }

    // Visual notifications
    if (this.settings.visualNotifications) {
      this.showVisualAlert(soundType, message, options?.customVisual);
    }

    // Screen flash
    if (this.settings.flashScreen) {
      this.flashScreen(isUrgent ? 3 : 1);
    }

    // Subtitles/captions
    if (this.settings.showSubtitles && (options?.subtitle || message)) {
      this.addSubtitle(
        options?.subtitle || message || this.getDefaultMessage(soundType),
        soundType,
      );
    }

    // Speech synthesis
    if (message && this.speechSynth) {
      this.speak(message);
    }

    // Screen reader announcement
    this.announceToScreenReader(message || this.getDefaultMessage(soundType));
  }

  private async playAccessibleAudio(
    soundType: SoundType,
    options?: { urgent?: boolean },
  ): Promise<void> {
    // Get sound source based on settings
    let audioSource = soundType;

    if (
      this.settings.personalizedSounds &&
      this.personalSounds.has(soundType)
    ) {
      // Use personalized sound
      audioSource = this.personalSounds.get(soundType) as SoundType;
    } else if (this.settings.culturalSounds) {
      // Use cultural sound pack
      const culturalPack = this.culturalSoundPacks.get(
        this.settings.languagePreference,
      );
      if (culturalPack && culturalPack[soundType]) {
        // Would need to load custom sound here
        console.log(`Using cultural sound: ${culturalPack[soundType]}`);
      }
    }

    // Apply hearing aid optimization
    if (this.settings.hearingAidMode) {
      // Optimize for hearing aids - clearer frequencies, reduced compression
      await enhancedAudioService.playSound(audioSource, {
        volume: 0.8, // Slightly lower volume to prevent distortion
        priority: options?.urgent ? "urgent" : "medium",
      });
    } else {
      // Standard playback with frequency adjustments
      await enhancedAudioService.playSound(audioSource, {
        priority: options?.urgent ? "urgent" : "medium",
      });
    }
  }

  private showVisualAlert(
    soundType: SoundType,
    message?: string,
    customVisual?: Partial<VisualAlert>,
  ): void {
    const alertColors = {
      "new-order": "#3498db",
      "order-ready": "#27ae60",
      "urgent-alert": "#e74c3c",
      "order-complete": "#f39c12",
      warning: "#f39c12",
      success: "#27ae60",
      error: "#e74c3c",
      notification: "#6c757d",
      bell: "#3498db",
      chime: "#6c757d",
      tick: "#6c757d",
      whoosh: "#6c757d",
    };

    const alert: VisualAlert = {
      id: `visual_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: "border",
      color: alertColors[soundType],
      duration: soundType === "urgent-alert" ? 3000 : 2000,
      intensity: soundType === "urgent-alert" ? 100 : 70,
      message,
      ...customVisual,
    };

    this.activeVisualAlerts.value.push(alert);

    // Auto-remove after duration
    setTimeout(() => {
      const index = this.activeVisualAlerts.value.findIndex(
        (a) => a.id === alert.id,
      );
      if (index !== -1) {
        this.activeVisualAlerts.value.splice(index, 1);
      }
    }, alert.duration);
  }

  private flashScreen(times = 1): void {
    let count = 0;
    const flash = () => {
      if (count >= times) return;

      // Create flash overlay
      const overlay = document.createElement("div");
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: ${this.settings.highContrast ? "#ffffff" : "#ffff00"};
        opacity: 0.6;
        z-index: 9999;
        pointer-events: none;
        animation: flash-fade 300ms ease-out;
      `;

      // Add flash animation
      const style = document.createElement("style");
      style.textContent = `
        @keyframes flash-fade {
          0% { opacity: 0.8; }
          50% { opacity: 0.4; }
          100% { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(overlay);

      setTimeout(() => {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
        count++;
        if (count < times) {
          setTimeout(flash, 200);
        }
      }, 300);
    };

    flash();
  }

  private addSubtitle(text: string, type: SoundType): void {
    const subtitle: SubtitleEntry = {
      id: `sub_${Date.now()}`,
      text: this.translateMessage(text),
      timestamp: Date.now(),
      duration: Math.max(3000, text.length * 100), // At least 3 seconds
      type: this.getSubtitleType(type),
      language: this.settings.languagePreference,
    };

    this.subtitles.value.unshift(subtitle);

    // Keep only last 5 subtitles
    if (this.subtitles.value.length > 5) {
      this.subtitles.value = this.subtitles.value.slice(0, 5);
    }

    // Auto-remove
    setTimeout(() => {
      const index = this.subtitles.value.findIndex((s) => s.id === subtitle.id);
      if (index !== -1) {
        this.subtitles.value.splice(index, 1);
      }
    }, subtitle.duration);
  }

  private speak(text: string): void {
    if (!this.speechSynth || !text) return;

    // Cancel any ongoing speech
    this.speechSynth.cancel();

    const utterance = new SpeechSynthesisUtterance(this.translateMessage(text));

    // Find appropriate voice
    const voices = this.availableVoices.value;
    const preferredVoice = voices.find(
      (voice) =>
        voice.lang.startsWith(this.getLanguageCode()) ||
        voice.lang.startsWith(this.settings.languagePreference),
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = this.settings.slowSpeech ? 0.7 : this.settings.speechRate;
    utterance.volume = 0.8;
    utterance.pitch = this.settings.hearingAidMode ? 1.2 : 1.0;

    // Add extra pauses for better comprehension
    if (this.settings.slowSpeech) {
      utterance.text = utterance.text.replace(/[。，！？]/g, "$&...");
    }

    this.speechSynth.speak(utterance);
  }

  private announceToScreenReader(message: string): void {
    // Create live region for screen readers
    let liveRegion = document.getElementById("kitchen-audio-announcements");

    if (!liveRegion) {
      liveRegion = document.createElement("div");
      liveRegion.id = "kitchen-audio-announcements";
      liveRegion.setAttribute("aria-live", "assertive");
      liveRegion.setAttribute("aria-atomic", "true");
      liveRegion.style.cssText = `
        position: absolute;
        left: -10000px;
        width: 1px;
        height: 1px;
        overflow: hidden;
      `;
      document.body.appendChild(liveRegion);
    }

    // Clear and set new message
    liveRegion.textContent = "";
    setTimeout(() => {
      liveRegion!.textContent = this.translateMessage(message);
    }, 100);

    // Keep history for debugging
    this.announcements.value.unshift(message);
    if (this.announcements.value.length > 20) {
      this.announcements.value = this.announcements.value.slice(0, 20);
    }
  }

  // Voice command processing
  startVoiceCommands(): void {
    if (!this.speechRecognition || !this.settings.voiceCommands) return;

    this.speechRecognition.lang = this.getLanguageCode();
    this.speechRecognition.start();
    this.isListening.value = true;
  }

  stopVoiceCommands(): void {
    if (!this.speechRecognition) return;

    this.speechRecognition.stop();
    this.isListening.value = false;
  }

  private processVoiceCommand(transcript: string): void {
    const command = transcript.toLowerCase().trim();
    console.log("Voice command received:", command);

    // Map voice commands to actions (multi-language support)
    const commands: Record<string, () => void> = {
      // English
      "complete order": () => this.triggerKeyboardShortcut("quick_complete"),
      "next order": () => this.triggerKeyboardShortcut("toggle_order_status"),
      "toggle audio": () => this.triggerKeyboardShortcut("toggle_audio"),
      "full screen": () => this.triggerKeyboardShortcut("toggle_fullscreen"),
      refresh: () => this.triggerKeyboardShortcut("refresh_orders"),

      // Traditional Chinese
      完成訂單: () => this.triggerKeyboardShortcut("quick_complete"),
      下一個訂單: () => this.triggerKeyboardShortcut("toggle_order_status"),
      切換音效: () => this.triggerKeyboardShortcut("toggle_audio"),
      全屏: () => this.triggerKeyboardShortcut("toggle_fullscreen"),
      刷新: () => this.triggerKeyboardShortcut("refresh_orders"),

      // Thai
      เสร็จสิ้นออเดอร์: () => this.triggerKeyboardShortcut("quick_complete"),
      ออเดอร์ถัดไป: () => this.triggerKeyboardShortcut("toggle_order_status"),
      เปิดปิดเสียง: () => this.triggerKeyboardShortcut("toggle_audio"),

      // Vietnamese
      "hoàn thành đơn hàng": () =>
        this.triggerKeyboardShortcut("quick_complete"),
      "đơn hàng tiếp theo": () =>
        this.triggerKeyboardShortcut("toggle_order_status"),
      "bật tắt âm thanh": () => this.triggerKeyboardShortcut("toggle_audio"),
    };

    const action = commands[command];
    if (action) {
      action();
      this.speak(this.getConfirmationMessage(command));
    } else {
      this.speak(this.getUnknownCommandMessage());
    }
  }

  private triggerKeyboardShortcut(action: string): void {
    // This would integrate with the keyboard shortcuts system
    document.dispatchEvent(
      new CustomEvent("voice-command", {
        detail: { action },
      }),
    );
  }

  // Utility methods
  private getDefaultMessage(soundType: SoundType): string {
    const messages = {
      "zh-TW": {
        "new-order": "新訂單到達",
        "order-ready": "訂單準備完成",
        "urgent-alert": "緊急警報！",
        "order-complete": "訂單已完成",
        warning: "警告",
        success: "操作成功",
        error: "發生錯誤",
        notification: "通知",
        bell: "提示音",
        chime: "鈴聲",
        tick: "確認",
        whoosh: "完成",
      },
      en: {
        "new-order": "New order received",
        "order-ready": "Order ready for pickup",
        "urgent-alert": "Urgent alert!",
        "order-complete": "Order completed",
        warning: "Warning",
        success: "Success",
        error: "Error occurred",
        notification: "Notification",
        bell: "Bell sound",
        chime: "Chime sound",
        tick: "Tick sound",
        whoosh: "Whoosh sound",
      },
    };

    const lang = this.settings.languagePreference.startsWith("zh")
      ? "zh-TW"
      : "en";
    return messages[lang][soundType] || `Sound: ${soundType}`;
  }

  private translateMessage(message: string): string {
    // This would integrate with a translation service
    // For now, return the original message
    return message;
  }

  private getLanguageCode(): string {
    const codes = {
      "zh-TW": "zh-TW",
      "zh-CN": "zh-CN",
      en: "en-US",
      th: "th-TH",
      vi: "vi-VN",
      id: "id-ID",
    };

    return codes[this.settings.languagePreference] || "en-US";
  }

  private getSubtitleType(
    soundType: SoundType,
  ): "notification" | "system" | "order" {
    const orderSounds: SoundType[] = [
      "new-order",
      "order-ready",
      "order-complete",
    ];
    const systemSounds: SoundType[] = ["warning", "error", "success"];

    if (orderSounds.includes(soundType)) return "order";
    if (systemSounds.includes(soundType)) return "system";
    return "notification";
  }

  private getConfirmationMessage(_command: string): string {
    return this.settings.languagePreference.startsWith("zh")
      ? "指令已執行"
      : "Command executed";
  }

  private getUnknownCommandMessage(): string {
    return this.settings.languagePreference.startsWith("zh")
      ? "未知指令，請重試"
      : "Unknown command, please try again";
  }

  // Settings management
  updateSettings(newSettings: Partial<AccessibilitySettings>): void {
    Object.assign(this.settings, newSettings);
    this.saveSettings();

    // Update speech recognition language if changed
    if (newSettings.languagePreference && this.speechRecognition) {
      this.speechRecognition.lang = this.getLanguageCode();
    }
  }

  private saveSettings(): void {
    localStorage.setItem(
      "kitchen-accessibility-settings",
      JSON.stringify(this.settings),
    );
  }

  private loadSettings(): void {
    const saved = localStorage.getItem("kitchen-accessibility-settings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        Object.assign(this.settings, parsed);
      } catch (error) {
        console.warn("Failed to load accessibility settings:", error);
      }
    }
  }

  // Public methods for external integration
  customizeSound(soundType: SoundType, audioPath: string): void {
    this.personalSounds.set(soundType, audioPath);
    this.saveSettings();
  }

  removeVisualAlert(alertId: string): void {
    const index = this.activeVisualAlerts.value.findIndex(
      (a) => a.id === alertId,
    );
    if (index !== -1) {
      this.activeVisualAlerts.value.splice(index, 1);
    }
  }

  clearAllSubtitles(): void {
    this.subtitles.value = [];
  }

  // Accessibility testing methods
  testAccessibilityFeature(feature: keyof AccessibilitySettings): void {
    switch (feature) {
      case "visualNotifications":
        this.showVisualAlert("notification", "測試視覺通知");
        break;
      case "flashScreen":
        this.flashScreen(2);
        break;
      case "showSubtitles":
        this.addSubtitle("測試字幕顯示功能", "notification");
        break;
      case "voiceCommands":
        this.speak("語音命令測試");
        break;
      default:
        console.log(`Testing ${feature}`);
    }
  }

  // Analytics and monitoring
  getAccessibilityAnalytics() {
    return {
      settings: { ...this.settings },
      usage: {
        visualAlertsShown: this.activeVisualAlerts.value.length,
        subtitlesGenerated: this.subtitles.value.length,
        voiceCommandsProcessed: this.announcements.value.length,
        speechSynthesisAvailable: !!this.speechSynth,
        speechRecognitionAvailable: !!this.speechRecognition,
      },
    };
  }
}

// Create and export singleton instance
export const audioAccessibilityService = new AudioAccessibilityService();
export default audioAccessibilityService;
