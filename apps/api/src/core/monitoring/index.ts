/**
 * Core Monitoring Module
 * Centralized monitoring and logging functionality
 */

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

export class ConsoleLogger implements Logger {
  constructor(private feature: string) {}

  info(message: string, context?: Record<string, unknown>): void {
    console.info(`[${this.feature}] INFO: ${message}`, context || "");
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`[${this.feature}] WARN: ${message}`, context || "");
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
  ): void {
    console.error(
      `[${this.feature}] ERROR: ${message}`,
      error?.stack || error?.message || "",
      context || "",
    );
  }

  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(`[${this.feature}] DEBUG: ${message}`, context || "");
  }
}

// Performance monitoring
export interface PerformanceTracker {
  startTimer(operation: string): string;
  endTimer(timerId: string): number;
  recordMetric(name: string, value: number, unit?: string): void;
}

export class SimplePerformanceTracker implements PerformanceTracker {
  private timers: Map<string, number> = new Map();

  startTimer(operation: string): string {
    const timerId = `${operation}_${Date.now()}_${Math.random()}`;
    this.timers.set(timerId, Date.now());
    return timerId;
  }

  endTimer(timerId: string): number {
    const startTime = this.timers.get(timerId);
    if (!startTime) {
      console.warn(`Timer ${timerId} not found`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(timerId);
    return duration;
  }

  recordMetric(name: string, value: number, unit = "count"): void {
    console.info(`METRIC: ${name} = ${value} ${unit}`);
  }
}

// Error reporting
export interface ErrorReporter {
  reportError(error: Error, context?: Record<string, unknown>): Promise<void>;
  reportWarning(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void>;
}

export class SlackErrorReporter implements ErrorReporter {
  constructor(private webhookUrl?: string) {}

  async reportError(
    error: Error,
    context?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 Error: ${error.message}`,
          attachments: [
            {
              color: "danger",
              fields: [
                {
                  title: "Stack",
                  value: error.stack?.substring(0, 500) || "No stack trace",
                },
                { title: "Context", value: JSON.stringify(context || {}) },
              ],
            },
          ],
        }),
      });
    } catch (reportError) {
      console.error("Failed to report error to Slack:", reportError);
    }
  }

  async reportWarning(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `⚠️ Warning: ${message}`,
          attachments: [
            {
              color: "warning",
              fields: [
                { title: "Context", value: JSON.stringify(context || {}) },
              ],
            },
          ],
        }),
      });
    } catch (reportError) {
      console.error("Failed to report warning to Slack:", reportError);
    }
  }
}
