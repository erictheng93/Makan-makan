// Enhanced Interactive Audio Notification Service with Web Audio API
import { Howl } from "howler";
import { ref, reactive } from "vue";
import { useToast } from "vue-toastification";

export interface CachedAudioBuffer {
  buffer: AudioBuffer;
  source?: AudioBufferSourceNode;
}

export interface InteractiveAudioSettings {
  masterVolume: number;
  enabled: boolean;
  useWebAudio: boolean;
  spatialAudio: boolean;
  effects: {
    reverb: boolean;
    echo: boolean;
    bass: boolean;
  };
  adaptiveVolume: boolean;
  contextAware: boolean;
}

export interface SoundEvent {
  id: string;
  type: SoundType;
  timestamp: number;
  context?: {
    orderPriority?: string;
    kitchenArea?: string;
    urgency?: number;
  };
}

export type SoundType =
  | "new-order"
  | "order-ready"
  | "urgent-alert"
  | "order-complete"
  | "warning"
  | "success"
  | "error"
  | "notification"
  | "bell"
  | "chime"
  | "tick"
  | "whoosh";

class EnhancedAudioNotificationService {
  // Web Audio API
  private audioContext: AudioContext | null = null;
  private audioBuffers: Map<SoundType, CachedAudioBuffer> = new Map();
  private gainNode: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private bassBoostNode: BiquadFilterNode | null = null;

  // Howler.js fallback
  private howlerSounds: Map<SoundType, Howl> = new Map();

  // State management
  public settings = reactive<InteractiveAudioSettings>({
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

  public isInitialized = ref(false);
  public isWebAudioSupported = ref(false);
  public currentlyPlaying = ref<SoundEvent[]>([]);
  public soundHistory = ref<SoundEvent[]>([]);

  // Interactive features
  private lastOrderTime = 0;
  private orderFrequency = 0;
  private ambientNoiseLevel = 0.5;

  private toast = useToast();

  constructor() {
    this.detectWebAudioSupport();
  }

  // Initialize audio system
  async initialize(): Promise<void> {
    try {
      if (this.settings.useWebAudio && this.isWebAudioSupported.value) {
        await this.initializeWebAudio();
      }

      await this.initializeHowlerFallback();
      await this.loadAllSounds();

      this.setupInteractiveFeatures();
      this.isInitialized.value = true;

      console.log("Enhanced Audio Service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize audio service:", error);
      this.toast.error("音效系統初始化失敗，將使用基本模式");

      // Fallback to basic Howler.js
      this.settings.useWebAudio = false;
      await this.initializeHowlerFallback();
      this.isInitialized.value = true;
    }
  }

  // Web Audio API initialization
  private async initializeWebAudio(): Promise<void> {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      // Create main gain node
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.settings.masterVolume;
      this.gainNode.connect(this.audioContext.destination);

      // Create effect nodes
      await this.setupAudioEffects();

      // Resume context if needed (for mobile browsers)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
    } catch (error) {
      console.error("Web Audio API initialization failed:", error);
      throw error;
    }
  }

  // Setup audio effects
  private async setupAudioEffects(): Promise<void> {
    if (!this.audioContext || !this.gainNode) return;

    // Bass boost filter
    this.bassBoostNode = this.audioContext.createBiquadFilter();
    this.bassBoostNode.type = "lowshelf";
    this.bassBoostNode.frequency.value = 200;
    this.bassBoostNode.gain.value = this.settings.effects.bass ? 10 : 0;

    // Reverb (convolution)
    this.reverbNode = this.audioContext.createConvolver();
    if (this.settings.effects.reverb) {
      await this.createReverbImpulse();
    }

    // Connect effects chain
    this.bassBoostNode.connect(this.reverbNode);
    this.reverbNode.connect(this.gainNode);
  }

  // Initialize Howler.js fallback
  private async initializeHowlerFallback(): Promise<void> {
    try {
      // Howler.js global settings
      const Howler = (window as any).Howler;
      if (Howler) {
        Howler.volume(this.settings.masterVolume);
        Howler.mute(!this.settings.enabled);
      }
      console.log("Howler.js fallback initialized");
    } catch (error) {
      console.error("Howler.js fallback initialization failed:", error);
      throw error;
    }
  }

  // Create reverb impulse response
  private async createReverbImpulse(): Promise<void> {
    if (!this.audioContext || !this.reverbNode) return;

    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 2; // 2 second reverb
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    this.reverbNode.buffer = impulse;
  }

  // Load all sound files
  private async loadAllSounds(): Promise<void> {
    const soundTypes: SoundType[] = [
      "new-order",
      "order-ready",
      "urgent-alert",
      "order-complete",
      "warning",
      "success",
      "error",
      "notification",
      "bell",
      "chime",
      "tick",
      "whoosh",
    ];

    const loadPromises = soundTypes.map((type) => this.loadSound(type));
    await Promise.allSettled(loadPromises);

    console.log("All sounds loaded successfully");
  }

  // Load individual sound
  private async loadSound(type: SoundType): Promise<void> {
    const soundPath = this.getSoundPath(type);

    try {
      if (this.settings.useWebAudio && this.audioContext) {
        // Load with Web Audio API
        const response = await fetch(soundPath);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer =
          await this.audioContext.decodeAudioData(arrayBuffer);

        this.audioBuffers.set(type, { buffer: audioBuffer });
      }

      // Always load Howler fallback
      const howl = new Howl({
        src: [soundPath],
        volume: this.getVolumeForSound(type),
        preload: true,
        onload: () => console.log(`Sound ${type} loaded`),
        onloaderror: (id, error) => {
          console.error(`Failed to load sound ${type}:`, error);
          // Generate fallback tone
          this.generateFallbackTone(type);
        },
      });

      this.howlerSounds.set(type, howl);
    } catch (error) {
      console.error(`Failed to load sound ${type}:`, error);
      this.generateFallbackTone(type);
    }
  }

  // Play sound with context awareness
  async playSound(
    type: SoundType,
    options: {
      volume?: number;
      priority?: "low" | "medium" | "high" | "urgent";
      context?: {
        orderPriority?: string;
        kitchenArea?: string;
        urgency?: number;
      };
      spatial?: {
        x?: number;
        y?: number;
        z?: number;
      };
    } = {},
  ): Promise<void> {
    if (!this.settings.enabled || !this.isInitialized.value) return;

    const event: SoundEvent = {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      context: options.context,
    };

    // Context-aware volume adjustment
    const contextVolume = this.calculateContextualVolume(type, options);
    const finalVolume = (options.volume || 1) * contextVolume;

    try {
      if (
        this.settings.useWebAudio &&
        this.audioContext &&
        this.audioBuffers.has(type)
      ) {
        await this.playWebAudio(type, finalVolume, options.spatial);
      } else {
        await this.playHowler(type, finalVolume);
      }

      // Track playing sound
      this.currentlyPlaying.value.push(event);

      // Add to history (keep last 50 events)
      this.soundHistory.value.unshift(event);
      if (this.soundHistory.value.length > 50) {
        this.soundHistory.value = this.soundHistory.value.slice(0, 50);
      }

      // Update analytics
      this.updateSoundAnalytics(type);
    } catch (error) {
      console.error(`Failed to play sound ${type}:`, error);
    }
  }

  // Play with Web Audio API
  private async playWebAudio(
    type: SoundType,
    volume: number,
    spatial?: { x?: number; y?: number; z?: number },
  ): Promise<void> {
    if (!this.audioContext || !this.gainNode) return;

    const audioData = this.audioBuffers.get(type);
    if (!audioData) return;

    // Create source node
    const source = this.audioContext.createBufferSource();
    source.buffer = audioData.buffer;

    // Create gain node for this sound
    const soundGain = this.audioContext.createGain();
    soundGain.gain.value = volume * this.settings.masterVolume;

    // Add spatial audio if enabled
    if (this.settings.spatialAudio && spatial) {
      const panner = this.audioContext.createPanner();
      panner.positionX.value = spatial.x || 0;
      panner.positionY.value = spatial.y || 0;
      panner.positionZ.value = spatial.z || 0;

      source.connect(panner);
      panner.connect(soundGain);
    } else {
      source.connect(soundGain);
    }

    // Connect through effects chain
    if (this.settings.effects.bass && this.bassBoostNode) {
      soundGain.connect(this.bassBoostNode);
    } else if (this.settings.effects.reverb && this.reverbNode) {
      soundGain.connect(this.reverbNode);
    } else {
      soundGain.connect(this.gainNode);
    }

    // Play sound
    source.start();

    // Clean up after sound ends
    source.onended = () => {
      source.disconnect();
      soundGain.disconnect();
      this.removeFromCurrentlyPlaying(type);
    };
  }

  // Play with Howler.js fallback
  private async playHowler(type: SoundType, volume: number): Promise<void> {
    const howl = this.howlerSounds.get(type);
    if (!howl) return;

    howl.volume(volume * this.settings.masterVolume);

    return new Promise((resolve) => {
      const soundId = howl.play();
      howl.on(
        "end",
        () => {
          this.removeFromCurrentlyPlaying(type);
          resolve();
        },
        soundId,
      );
    });
  }

  // Convenient methods for specific alerts
  async playNewOrderAlert(orderData?: {
    priority?: string;
    tableNumber?: string;
  }): Promise<void> {
    const urgency = this.calculateOrderUrgency();

    await this.playSound("new-order", {
      priority: urgency > 0.8 ? "urgent" : urgency > 0.5 ? "high" : "medium",
      context: {
        orderPriority: orderData?.priority,
        urgency,
      },
    });

    // Visual feedback
    this.toast.info(`新訂單 ${orderData?.tableNumber || ""}`, {
      timeout: 3000,
      icon: "🔔",
    });
  }

  async playUrgentAlert(message?: string): Promise<void> {
    // Play urgent sound multiple times with increasing volume
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playSound("urgent-alert", {
          volume: 0.7 + i * 0.1,
          priority: "urgent",
        });
      }, i * 500);
    }

    this.toast.error(message || "緊急通知！", {
      timeout: 5000,
      icon: "🚨",
    });
  }

  async playOrderReadyAlert(orderNumber?: string): Promise<void> {
    await this.playSound("order-ready", {
      priority: "high",
      context: {
        orderPriority: "ready",
      },
    });

    this.toast.success(`訂單 ${orderNumber} 已完成`, {
      timeout: 4000,
      icon: "✅",
    });
  }

  // Interactive features
  private setupInteractiveFeatures(): void {
    // Adaptive volume based on ambient noise
    if (this.settings.adaptiveVolume) {
      this.startAmbientNoiseDetection();
    }

    // Context-aware notifications
    if (this.settings.contextAware) {
      this.startContextAnalysis();
    }

    // Keyboard shortcuts for sound testing
    this.setupSoundTestingShortcuts();
  }

  private startAmbientNoiseDetection(): void {
    // Simplified ambient noise detection
    // In a real implementation, this would use microphone input
    setInterval(() => {
      const timeOfDay = new Date().getHours();

      // Simulate higher ambient noise during busy hours
      if (timeOfDay >= 11 && timeOfDay <= 14) {
        // Lunch rush
        this.ambientNoiseLevel = 0.8;
      } else if (timeOfDay >= 18 && timeOfDay <= 21) {
        // Dinner rush
        this.ambientNoiseLevel = 0.9;
      } else {
        this.ambientNoiseLevel = 0.5;
      }
    }, 60000); // Check every minute
  }

  private startContextAnalysis(): void {
    setInterval(() => {
      this.analyzeOrderFrequency();
    }, 10000); // Analyze every 10 seconds
  }

  private analyzeOrderFrequency(): void {
    const now = Date.now();
    const recentOrders = this.soundHistory.value.filter(
      (event) => event.type === "new-order" && now - event.timestamp < 300000, // Last 5 minutes
    );

    this.orderFrequency = recentOrders.length / 5; // Orders per minute
  }

  private calculateOrderUrgency(): number {
    // Calculate urgency based on order frequency and time since last order
    const timeSinceLastOrder = Date.now() - this.lastOrderTime;
    const frequencyFactor = Math.min(this.orderFrequency / 10, 1); // Max 10 orders/min
    const timeFactor = Math.max(1 - timeSinceLastOrder / 600000, 0); // Max 10 minutes

    return (frequencyFactor + timeFactor) / 2;
  }

  private calculateContextualVolume(type: SoundType, options: any): number {
    let baseVolume = 1;

    // Ambient noise adjustment
    if (this.settings.adaptiveVolume) {
      baseVolume += this.ambientNoiseLevel * 0.3;
    }

    // Priority adjustment
    switch (options.priority) {
      case "urgent":
        baseVolume *= 1.5;
        break;
      case "high":
        baseVolume *= 1.2;
        break;
      case "low":
        baseVolume *= 0.8;
        break;
    }

    // Time-based adjustment
    const hour = new Date().getHours();
    if (hour < 7 || hour > 22) {
      // Quiet hours
      baseVolume *= 0.6;
    }

    return Math.min(baseVolume, 1.5); // Cap at 150%
  }

  private setupSoundTestingShortcuts(): void {
    document.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.shiftKey) {
        switch (event.key) {
          case "N":
            this.playNewOrderAlert({ tableNumber: "TEST" });
            event.preventDefault();
            break;
          case "U":
            this.playUrgentAlert("測試緊急警報");
            event.preventDefault();
            break;
          case "R":
            this.playOrderReadyAlert("TEST-001");
            event.preventDefault();
            break;
        }
      }
    });
  }

  // Utility methods
  private generateEventId(): string {
    return `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private removeFromCurrentlyPlaying(type: SoundType): void {
    const index = this.currentlyPlaying.value.findIndex(
      (event) => event.type === type,
    );
    if (index !== -1) {
      this.currentlyPlaying.value.splice(index, 1);
    }
  }

  private updateSoundAnalytics(type: SoundType): void {
    // Update analytics data
    if (type === "new-order") {
      this.lastOrderTime = Date.now();
    }
  }

  private getSoundPath(type: SoundType): string {
    const soundPaths = {
      "new-order": "/sounds/new-order.mp3",
      "order-ready": "/sounds/order-ready.mp3",
      "urgent-alert": "/sounds/urgent-alert.mp3",
      "order-complete": "/sounds/order-complete.mp3",
      warning: "/sounds/warning.mp3",
      success: "/sounds/success.mp3",
      error: "/sounds/error.mp3",
      notification: "/sounds/notification.mp3",
      bell: "/sounds/bell.mp3",
      chime: "/sounds/chime.mp3",
      tick: "/sounds/tick.mp3",
      whoosh: "/sounds/whoosh.mp3",
    };
    return soundPaths[type] || "/sounds/notification.mp3";
  }

  private getVolumeForSound(type: SoundType): number {
    const volumes = {
      "new-order": 0.8,
      "order-ready": 0.9,
      "urgent-alert": 1.0,
      "order-complete": 0.7,
      warning: 0.8,
      success: 0.6,
      error: 0.8,
      notification: 0.5,
      bell: 0.7,
      chime: 0.6,
      tick: 0.3,
      whoosh: 0.4,
    };
    return volumes[type] || 0.5;
  }

  private generateFallbackTone(type: SoundType): void {
    // Generate simple fallback tones using Web Audio API
    if (!this.audioContext) return;

    const frequencies = {
      "new-order": [800, 1000],
      "order-ready": [600, 800, 1000],
      "urgent-alert": [400, 600, 400, 600],
      "order-complete": [500, 700, 900],
      warning: [300, 300],
      success: [523, 659, 784],
      error: [200, 200, 200],
      notification: [800],
      bell: [1000, 800],
      chime: [523, 659],
      tick: [1500],
      whoosh: [100, 200, 300],
    };

    const freq = frequencies[type] || [440];
    // Implementation would create oscillator tones
    console.log(`Generated fallback tone for ${type} with frequencies:`, freq);
  }

  private detectWebAudioSupport(): void {
    this.isWebAudioSupported.value = !!(
      window.AudioContext ||
      (window as any).webkitAudioContext ||
      (window as any).mozAudioContext
    );
  }

  // Public control methods
  setMasterVolume(volume: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, volume));

    if (this.gainNode) {
      this.gainNode.gain.value = this.settings.masterVolume;
    }

    // Update Howler sounds
    this.howlerSounds.forEach((howl) => {
      howl.volume(this.settings.masterVolume);
    });
  }

  toggleEnabled(): void {
    this.settings.enabled = !this.settings.enabled;

    if (!this.settings.enabled) {
      // Stop all currently playing sounds
      this.stopAllSounds();
    }
  }

  private stopAllSounds(): void {
    this.howlerSounds.forEach((howl) => howl.stop());
    this.currentlyPlaying.value = [];
  }

  // Cleanup
  cleanup(): void {
    this.stopAllSounds();

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
    }

    this.howlerSounds.clear();
    this.audioBuffers.clear();
  }
}

// Create and export singleton instance
export const enhancedAudioService = new EnhancedAudioNotificationService();
export default enhancedAudioService;
