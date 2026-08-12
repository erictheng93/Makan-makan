/**
 * Printer Health Monitor
 * Monitors printer status and health metrics
 */

export interface PrinterHealth {
  status: "online" | "offline" | "error" | "unknown";
  lastSeen: Date;
  errorCount: number;
  averageResponseTime: number;
}

/**
 * Events this monitor exposes.
 *
 * `health-changed` is the only one it emits. `device_status_changed` and
 * `device_error` are subscribed to by PrinterService but never fired — those
 * two subscriptions have been dead since they were written. They are declared
 * here so the gap is visible in the contract rather than hidden behind an
 * untyped emitter; wiring or removing them is a behaviour change tracked
 * separately.
 */
export type PrinterHealthMonitorEvents = {
  "health-changed": { deviceId: string; health: PrinterHealth };
  device_status_changed: {
    deviceId: string;
    oldStatus: string;
    newStatus: string;
  };
  device_error: { deviceId: string; error: unknown };
};

export class PrinterHealthMonitor {
  private healthData = new Map<string, PrinterHealth>();
  private eventHandlers = new Map<
    keyof PrinterHealthMonitorEvents,
    ((payload: never) => void)[]
  >();
  private isInitialized = false;

  /**
   * Update health status for a printer
   */
  updateHealth(
    deviceId: string,
    status: PrinterHealth["status"],
    responseTime?: number,
  ): void {
    const current = this.healthData.get(deviceId) || {
      status: "unknown",
      lastSeen: new Date(),
      errorCount: 0,
      averageResponseTime: 0,
    };

    const updated: PrinterHealth = {
      ...current,
      status,
      lastSeen: new Date(),
      errorCount:
        status === "error" ? current.errorCount + 1 : current.errorCount,
      averageResponseTime: responseTime
        ? (current.averageResponseTime + responseTime) / 2
        : current.averageResponseTime,
    };

    this.healthData.set(deviceId, updated);

    // Emit health change event
    this.emit("health-changed", { deviceId, health: updated });
  }

  /**
   * Get health status for a printer
   */
  getHealth(deviceId: string): PrinterHealth | null {
    return this.healthData.get(deviceId) || null;
  }

  /**
   * Get all printer health data
   */
  getAllHealth(): Map<string, PrinterHealth> {
    return new Map(this.healthData);
  }

  /**
   * Check if printer is healthy
   */
  isHealthy(deviceId: string): boolean {
    const health = this.getHealth(deviceId);
    return health?.status === "online";
  }

  /**
   * Initialize the health monitor
   */
  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  /**
   * Check if health monitor is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Shutdown the health monitor
   */
  async shutdown(): Promise<void> {
    this.isInitialized = false;
    this.eventHandlers.clear();
  }

  /**
   * Add a device to monitor
   */
  addDevice(deviceId: string): void {
    if (!this.healthData.has(deviceId)) {
      this.healthData.set(deviceId, {
        status: "unknown",
        lastSeen: new Date(),
        errorCount: 0,
        averageResponseTime: 0,
      });
    }
  }

  /**
   * Remove a device from monitoring
   */
  removeDevice(deviceId: string): void {
    this.healthData.delete(deviceId);
  }

  /**
   * Get device statuses
   */
  getDeviceStatuses(): Map<string, PrinterHealth["status"]> {
    const statuses = new Map<string, PrinterHealth["status"]>();
    for (const [deviceId, health] of this.healthData) {
      statuses.set(deviceId, health.status);
    }
    return statuses;
  }

  /**
   * Add event listener
   */
  on<K extends keyof PrinterHealthMonitorEvents>(
    event: K,
    handler: (payload: PrinterHealthMonitorEvents[K]) => void,
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler as (payload: never) => void);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof PrinterHealthMonitorEvents>(
    event: K,
    handler: (payload: PrinterHealthMonitorEvents[K]) => void,
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler as (payload: never) => void);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emit<K extends keyof PrinterHealthMonitorEvents>(
    event: K,
    data: PrinterHealthMonitorEvents[K],
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) =>
        (handler as (payload: PrinterHealthMonitorEvents[K]) => void)(data),
      );
    }
  }
}
