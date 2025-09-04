// Contextual Audio Notification Service
import { ref, reactive } from "vue";
import { enhancedAudioService, type SoundType } from "./enhancedAudioService";
import type { KitchenOrder } from "@/types";

// Context types
export type KitchenContext =
  | "quiet-hours" // Early morning/late evening
  | "preparation" // Pre-service prep
  | "lunch-rush" // Lunch service peak
  | "afternoon-lull" // Between meal services
  | "dinner-rush" // Dinner service peak
  | "closing-time" // End of service
  | "overnight"; // After hours

export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export interface ContextualNotification {
  id: string;
  type: SoundType;
  context: KitchenContext;
  urgency: UrgencyLevel;
  orderData?: {
    id?: string;
    priority?: string;
    waitTime?: number;
    tableNumber?: string;
    specialInstructions?: boolean;
    allergyAlert?: boolean;
  };
  environmental?: {
    ambientNoise: number;
    staffCount: number;
    orderBacklog: number;
  };
  adaptations: {
    volume: number;
    repeat: number;
    delay: number;
    useAlternateSound?: boolean;
  };
  timestamp: number;
}

export interface ContextProfile {
  name: string;
  timeRanges: { start: number; end: number }[];
  characteristics: {
    baseVolume: number;
    urgencyMultiplier: number;
    repeatBehavior: "normal" | "reduced" | "enhanced";
    soundVariation: boolean;
  };
  triggers: {
    orderThreshold: number; // Orders per minute to trigger enhanced mode
    waitTimeThreshold: number; // Minutes before urgent escalation
    backlogThreshold: number; // Number of pending orders
  };
}

// Predefined context profiles
const CONTEXT_PROFILES: Record<KitchenContext, ContextProfile> = {
  "quiet-hours": {
    name: "安靜時段",
    timeRanges: [{ start: 22, end: 7 }],
    characteristics: {
      baseVolume: 0.4,
      urgencyMultiplier: 0.8,
      repeatBehavior: "reduced",
      soundVariation: false,
    },
    triggers: {
      orderThreshold: 2,
      waitTimeThreshold: 15,
      backlogThreshold: 3,
    },
  },
  preparation: {
    name: "準備時段",
    timeRanges: [
      { start: 7, end: 10 },
      { start: 14, end: 17 },
    ],
    characteristics: {
      baseVolume: 0.6,
      urgencyMultiplier: 1.0,
      repeatBehavior: "normal",
      soundVariation: true,
    },
    triggers: {
      orderThreshold: 3,
      waitTimeThreshold: 12,
      backlogThreshold: 5,
    },
  },
  "lunch-rush": {
    name: "午餐繁忙",
    timeRanges: [{ start: 11, end: 14 }],
    characteristics: {
      baseVolume: 0.9,
      urgencyMultiplier: 1.3,
      repeatBehavior: "enhanced",
      soundVariation: true,
    },
    triggers: {
      orderThreshold: 8,
      waitTimeThreshold: 8,
      backlogThreshold: 10,
    },
  },
  "afternoon-lull": {
    name: "下午淡季",
    timeRanges: [{ start: 14, end: 17 }],
    characteristics: {
      baseVolume: 0.5,
      urgencyMultiplier: 0.9,
      repeatBehavior: "normal",
      soundVariation: false,
    },
    triggers: {
      orderThreshold: 2,
      waitTimeThreshold: 18,
      backlogThreshold: 4,
    },
  },
  "dinner-rush": {
    name: "晚餐繁忙",
    timeRanges: [{ start: 17, end: 21 }],
    characteristics: {
      baseVolume: 0.95,
      urgencyMultiplier: 1.4,
      repeatBehavior: "enhanced",
      soundVariation: true,
    },
    triggers: {
      orderThreshold: 10,
      waitTimeThreshold: 6,
      backlogThreshold: 15,
    },
  },
  "closing-time": {
    name: "結束營業",
    timeRanges: [{ start: 21, end: 22 }],
    characteristics: {
      baseVolume: 0.7,
      urgencyMultiplier: 1.1,
      repeatBehavior: "normal",
      soundVariation: false,
    },
    triggers: {
      orderThreshold: 3,
      waitTimeThreshold: 10,
      backlogThreshold: 5,
    },
  },
  overnight: {
    name: "夜間時段",
    timeRanges: [{ start: 22, end: 7 }],
    characteristics: {
      baseVolume: 0.3,
      urgencyMultiplier: 0.7,
      repeatBehavior: "reduced",
      soundVariation: false,
    },
    triggers: {
      orderThreshold: 1,
      waitTimeThreshold: 20,
      backlogThreshold: 2,
    },
  },
};

class ContextualAudioService {
  // State management
  public currentContext = ref<KitchenContext>("preparation");
  public contextHistory = ref<{ context: KitchenContext; timestamp: number }[]>(
    [],
  );
  public notificationHistory = ref<ContextualNotification[]>([]);

  // Environmental tracking
  private environmentalState = reactive({
    ambientNoise: 0.5,
    staffCount: 3,
    orderBacklog: 0,
    averageWaitTime: 0,
    recentOrderRate: 0,
  });

  // Adaptive learning
  private adaptiveLearning = reactive({
    volumeAdjustments: new Map<KitchenContext, number>(),
    soundPreferences: new Map<SoundType, number>(),
    contextTransitions: new Map<string, number>(),
    effectiveness: new Map<string, number>(),
  });

  // Context detection
  detectCurrentContext(): KitchenContext {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday

    // Weekend detection
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Special context detection based on environmental factors
    if (this.environmentalState.orderBacklog > 15) {
      return hour < 15 ? "lunch-rush" : "dinner-rush";
    }

    if (this.environmentalState.recentOrderRate > 10) {
      return hour < 15 ? "lunch-rush" : "dinner-rush";
    }

    // Time-based context detection
    for (const [contextKey, profile] of Object.entries(CONTEXT_PROFILES)) {
      for (const timeRange of profile.timeRanges) {
        if (this.isTimeInRange(hour, timeRange)) {
          // Adjust for weekends
          if (
            isWeekend &&
            (contextKey === "lunch-rush" || contextKey === "dinner-rush")
          ) {
            // Weekends are generally less busy
            return contextKey === "lunch-rush"
              ? "preparation"
              : "afternoon-lull";
          }

          return contextKey as KitchenContext;
        }
      }
    }

    // Default fallback
    return "preparation";
  }

  private isTimeInRange(
    hour: number,
    range: { start: number; end: number },
  ): boolean {
    if (range.start <= range.end) {
      return hour >= range.start && hour < range.end;
    } else {
      // Spans midnight (e.g., 22-7)
      return hour >= range.start || hour < range.end;
    }
  }

  // Context-aware notification
  async sendContextualNotification(
    type: SoundType,
    orderData?: Partial<ContextualNotification["orderData"]>,
    options?: {
      forceUrgency?: UrgencyLevel;
      ignoreContext?: boolean;
      customAdaptations?: Partial<ContextualNotification["adaptations"]>;
    },
  ): Promise<void> {
    const context = options?.ignoreContext
      ? "preparation"
      : this.detectCurrentContext();

    // Calculate urgency based on order data and context
    const urgency = this.calculateUrgency(
      type,
      orderData,
      context,
      options?.forceUrgency,
    );

    // Generate contextual adaptations
    const adaptations = this.generateAdaptations(
      type,
      urgency,
      context,
      options?.customAdaptations,
    );

    // Create notification record
    const notification: ContextualNotification = {
      id: this.generateNotificationId(),
      type,
      context,
      urgency,
      orderData,
      environmental: { ...this.environmentalState },
      adaptations,
      timestamp: Date.now(),
    };

    // Execute the notification
    await this.executeNotification(notification);

    // Record for learning
    this.recordNotification(notification);
  }

  private calculateUrgency(
    type: SoundType,
    orderData?: Partial<ContextualNotification["orderData"]>,
    context?: KitchenContext,
    forceUrgency?: UrgencyLevel,
  ): UrgencyLevel {
    if (forceUrgency) return forceUrgency;

    const profile = CONTEXT_PROFILES[context || this.currentContext.value];
    let urgencyScore = 0;

    // Base urgency by sound type
    const baseUrgency = {
      "urgent-alert": 3,
      "new-order": 2,
      "order-ready": 2,
      warning: 2,
      error: 3,
      "order-complete": 1,
      success: 0,
      notification: 1,
      bell: 1,
      chime: 0,
      tick: 0,
      whoosh: 0,
    };

    urgencyScore += baseUrgency[type] || 1;

    // Order-based urgency factors
    if (orderData) {
      // Wait time factor
      if (
        orderData.waitTime &&
        orderData.waitTime > profile.triggers.waitTimeThreshold
      ) {
        urgencyScore += Math.floor(
          (orderData.waitTime - profile.triggers.waitTimeThreshold) / 5,
        );
      }

      // Priority factor
      if (orderData.priority === "urgent") urgencyScore += 2;
      if (orderData.priority === "high") urgencyScore += 1;

      // Special conditions
      if (orderData.allergyAlert) urgencyScore += 1;
      if (orderData.specialInstructions) urgencyScore += 0.5;
    }

    // Environmental factors
    if (
      this.environmentalState.orderBacklog > profile.triggers.backlogThreshold
    ) {
      urgencyScore += 1;
    }

    if (
      this.environmentalState.recentOrderRate > profile.triggers.orderThreshold
    ) {
      urgencyScore += 1;
    }

    // Convert score to urgency level
    if (urgencyScore >= 4) return "critical";
    if (urgencyScore >= 3) return "high";
    if (urgencyScore >= 2) return "medium";
    return "low";
  }

  private generateAdaptations(
    type: SoundType,
    urgency: UrgencyLevel,
    context: KitchenContext,
    customAdaptations?: Partial<ContextualNotification["adaptations"]>,
  ): ContextualNotification["adaptations"] {
    const profile = CONTEXT_PROFILES[context];

    // Base volume calculation
    let volume = profile.characteristics.baseVolume;

    // Urgency adjustments
    const urgencyMultipliers = {
      low: 0.8,
      medium: 1.0,
      high: 1.2,
      critical: 1.5,
    };

    volume *=
      urgencyMultipliers[urgency] * profile.characteristics.urgencyMultiplier;

    // Adaptive learning adjustments
    const learningAdjustment =
      this.adaptiveLearning.volumeAdjustments.get(context) || 1.0;
    volume *= learningAdjustment;

    // Ambient noise compensation
    volume += (this.environmentalState.ambientNoise - 0.5) * 0.3;

    // Clamp volume
    volume = Math.max(0.1, Math.min(1.0, volume));

    // Repeat calculation
    let repeat = 1;
    switch (profile.characteristics.repeatBehavior) {
      case "reduced":
        repeat = urgency === "critical" ? 2 : 1;
        break;
      case "enhanced":
        repeat =
          urgency === "critical"
            ? 4
            : urgency === "high"
              ? 3
              : urgency === "medium"
                ? 2
                : 1;
        break;
      default:
        repeat = urgency === "critical" ? 3 : urgency === "high" ? 2 : 1;
    }

    // Delay calculation (for staggered alerts)
    const delay = urgency === "critical" ? 0 : urgency === "high" ? 100 : 200;

    // Alternate sound selection
    const useAlternateSound =
      profile.characteristics.soundVariation &&
      this.shouldUseAlternateSound(type, context);

    return {
      volume,
      repeat,
      delay,
      useAlternateSound,
      ...customAdaptations,
    };
  }

  private shouldUseAlternateSound(
    type: SoundType,
    context: KitchenContext,
  ): boolean {
    // Use alternate sounds during busy periods to avoid habituation
    const busyContexts: KitchenContext[] = ["lunch-rush", "dinner-rush"];

    if (!busyContexts.includes(context)) return false;

    // Use alternate sound if the same sound type was used recently
    const recentNotifications = this.notificationHistory.value
      .filter((n) => n.timestamp > Date.now() - 60000) // Last minute
      .filter((n) => n.type === type);

    return recentNotifications.length >= 2;
  }

  private async executeNotification(
    notification: ContextualNotification,
  ): Promise<void> {
    const { type, adaptations, urgency, context } = notification;

    try {
      // Determine sound variant
      let soundType = type;
      if (adaptations.useAlternateSound) {
        soundType = this.getAlternateSound(type);
      }

      // Execute the notification with adaptations
      for (let i = 0; i < adaptations.repeat; i++) {
        if (i > 0) {
          await this.delay(adaptations.delay + i * 100);
        }

        await enhancedAudioService.playSound(soundType, {
          volume: adaptations.volume,
          priority: this.mapUrgencyToPriority(urgency),
          context: {
            orderPriority: notification.orderData?.priority,
            kitchenArea: this.getKitchenArea(context),
            urgency: this.mapUrgencyToNumber(urgency),
          },
        });
      }

      // Track effectiveness (simplified)
      this.trackNotificationEffectiveness(notification);
    } catch (error) {
      console.error("Failed to execute contextual notification:", error);
    }
  }

  private getAlternateSound(originalType: SoundType): SoundType {
    const alternates: Record<SoundType, SoundType> = {
      "new-order": "bell",
      "order-ready": "chime",
      "urgent-alert": "warning",
      "order-complete": "success",
      warning: "urgent-alert",
      success: "chime",
      error: "warning",
      notification: "tick",
      bell: "new-order",
      chime: "success",
      tick: "notification",
      whoosh: "tick",
    };

    return alternates[originalType] || originalType;
  }

  private mapUrgencyToPriority(
    urgency: UrgencyLevel,
  ): "low" | "medium" | "high" | "urgent" {
    const mapping = {
      low: "low" as const,
      medium: "medium" as const,
      high: "high" as const,
      critical: "urgent" as const,
    };

    return mapping[urgency];
  }

  private mapUrgencyToNumber(urgency: UrgencyLevel): number {
    const mapping = {
      low: 0.25,
      medium: 0.5,
      high: 0.75,
      critical: 1.0,
    };

    return mapping[urgency];
  }

  private getKitchenArea(context: KitchenContext): string {
    const areas = {
      "quiet-hours": "prep",
      preparation: "prep",
      "lunch-rush": "hot-line",
      "afternoon-lull": "cold-line",
      "dinner-rush": "hot-line",
      "closing-time": "cleaning",
      overnight: "storage",
    };

    return areas[context] || "general";
  }

  // Utility methods
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateNotificationId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  private recordNotification(notification: ContextualNotification): void {
    // Add to history
    this.notificationHistory.value.unshift(notification);

    // Keep only last 100 notifications
    if (this.notificationHistory.value.length > 100) {
      this.notificationHistory.value = this.notificationHistory.value.slice(
        0,
        100,
      );
    }

    // Update context if changed
    if (notification.context !== this.currentContext.value) {
      this.contextHistory.value.unshift({
        context: this.currentContext.value,
        timestamp: Date.now(),
      });

      this.currentContext.value = notification.context;
    }
  }

  private trackNotificationEffectiveness(
    notification: ContextualNotification,
  ): void {
    // This would track whether the notification was effective
    // For now, we'll just record basic metrics
    const key = `${notification.context}_${notification.type}_${notification.urgency}`;
    const current = this.adaptiveLearning.effectiveness.get(key) || 0;
    this.adaptiveLearning.effectiveness.set(key, current + 1);
  }

  // Public methods for environmental updates
  updateEnvironmentalState(
    updates: Partial<typeof this.environmentalState>,
  ): void {
    Object.assign(this.environmentalState, updates);
  }

  updateOrderBacklog(count: number): void {
    this.environmentalState.orderBacklog = count;
  }

  updateRecentOrderRate(ordersPerMinute: number): void {
    this.environmentalState.recentOrderRate = ordersPerMinute;
  }

  updateStaffCount(count: number): void {
    this.environmentalState.staffCount = count;
  }

  updateAmbientNoise(level: number): void {
    this.environmentalState.ambientNoise = Math.max(0, Math.min(1, level));
  }

  // Convenience methods for common scenarios
  async notifyNewOrder(order: KitchenOrder): Promise<void> {
    const waitTime = order.createdAt
      ? Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000)
      : 0;

    await this.sendContextualNotification("new-order", {
      id: order.id.toString(),
      priority: order.priority || "normal",
      waitTime,
      tableNumber: order.tableName,
      specialInstructions: !!(order.notes && order.notes.length > 0),
      allergyAlert: order.items?.some(
        (item) => (item as any).allergens?.length > 0,
      ),
    });
  }

  async notifyOrderReady(order: KitchenOrder): Promise<void> {
    await this.sendContextualNotification("order-ready", {
      id: order.id.toString(),
      priority: order.priority || "normal",
      waitTime: 0,
      tableNumber: order.tableName,
    });
  }

  async notifyUrgentAlert(message: string, orderId?: string): Promise<void> {
    await this.sendContextualNotification(
      "urgent-alert",
      {
        id: orderId || "system",
        priority: "urgent",
        waitTime: 0,
      },
      {
        forceUrgency: "critical",
      },
    );
  }

  // Analytics and insights
  getContextAnalytics() {
    const contexts = this.contextHistory.value.slice(0, 24); // Last 24 context changes
    const notifications = this.notificationHistory.value.slice(0, 50); // Last 50 notifications

    return {
      currentContext: this.currentContext.value,
      contextDistribution: this.getContextDistribution(contexts),
      notificationsByUrgency: this.getNotificationsByUrgency(notifications),
      effectivenessMetrics: Object.fromEntries(
        this.adaptiveLearning.effectiveness,
      ),
      environmentalState: { ...this.environmentalState },
    };
  }

  private getContextDistribution(
    contexts: { context: KitchenContext; timestamp: number }[],
  ) {
    const distribution = new Map<KitchenContext, number>();

    contexts.forEach(({ context }) => {
      distribution.set(context, (distribution.get(context) || 0) + 1);
    });

    return Object.fromEntries(distribution);
  }

  private getNotificationsByUrgency(notifications: ContextualNotification[]) {
    const distribution = new Map<UrgencyLevel, number>();

    notifications.forEach(({ urgency }) => {
      distribution.set(urgency, (distribution.get(urgency) || 0) + 1);
    });

    return Object.fromEntries(distribution);
  }
}

// Create and export singleton instance
export const contextualAudioService = new ContextualAudioService();
export default contextualAudioService;
