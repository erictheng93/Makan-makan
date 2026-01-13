/**
 * Alert Service
 * 告警服務 - Phase 3 實施
 */

import type { ManagementEnv, HealthCheck, Tenant } from "../types";

export interface AlertRule {
  id: string;
  name: string;
  condition:
    | "health_down"
    | "health_degraded"
    | "response_time"
    | "deployment_failed";
  threshold?: number;
  channels: ("slack" | "email")[];
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  tenantId: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  status: "active" | "acknowledged" | "resolved";
  createdAt: string;
  resolvedAt?: string;
}

export class AlertService {
  private env: ManagementEnv;

  constructor(env: ManagementEnv) {
    this.env = env;
  }

  /**
   * 處理健康檢查結果，生成告警
   */
  async processHealthCheck(
    tenant: Tenant,
    healthCheck: HealthCheck,
  ): Promise<Alert | null> {
    // 只有異常狀態才生成告警
    if (healthCheck.status === "healthy") {
      // 檢查是否有需要解除的告警
      await this.resolveAlerts(tenant.id, "health");
      return null;
    }

    const severity = healthCheck.status === "down" ? "critical" : "warning";
    const title =
      healthCheck.status === "down"
        ? `${tenant.businessName} 服務離線`
        : `${tenant.businessName} 服務降級`;

    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      ruleId: `health_${healthCheck.status}`,
      tenantId: tenant.id,
      severity,
      title,
      message: this.buildHealthAlertMessage(tenant, healthCheck),
      status: "active",
      createdAt: new Date().toISOString(),
    };

    // 發送通知
    await this.sendNotifications(alert, tenant);

    return alert;
  }

  /**
   * 處理部署失敗，生成告警
   */
  async processDeploymentFailure(
    tenant: Tenant,
    deploymentId: string,
    error: string,
  ): Promise<Alert> {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      ruleId: "deployment_failed",
      tenantId: tenant.id,
      severity: "critical",
      title: `${tenant.businessName} 部署失敗`,
      message: `部署 ID: ${deploymentId}\n錯誤: ${error}`,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    await this.sendNotifications(alert, tenant);

    return alert;
  }

  /**
   * 建立健康告警訊息
   */
  private buildHealthAlertMessage(
    tenant: Tenant,
    healthCheck: HealthCheck,
  ): string {
    const lines = [
      `租戶: ${tenant.businessName}`,
      `狀態: ${healthCheck.status}`,
      `回應時間: ${healthCheck.responseTimeMs || "N/A"}ms`,
      `檢查時間: ${healthCheck.checkedAt}`,
    ];

    if (healthCheck.details) {
      lines.push("", "組件狀態:");
      const details =
        typeof healthCheck.details === "string"
          ? JSON.parse(healthCheck.details)
          : healthCheck.details;
      Object.entries(details).forEach(([key, value]) => {
        lines.push(`  - ${key}: ${value}`);
      });
    }

    return lines.join("\n");
  }

  /**
   * 發送通知
   */
  private async sendNotifications(alert: Alert, tenant: Tenant): Promise<void> {
    const promises: Promise<void>[] = [];

    // 發送 Slack 通知
    if (this.env.SLACK_WEBHOOK_URL) {
      promises.push(this.sendSlackNotification(alert, tenant));
    }

    // 發送郵件通知（如果配置了）
    // if (this.env.EMAIL_API_KEY) {
    //   promises.push(this.sendEmailNotification(alert, tenant));
    // }

    await Promise.allSettled(promises);
  }

  /**
   * 發送 Slack 通知
   */
  private async sendSlackNotification(
    alert: Alert,
    tenant: Tenant,
  ): Promise<void> {
    if (!this.env.SLACK_WEBHOOK_URL) return;

    const color =
      alert.severity === "critical"
        ? "#dc2626"
        : alert.severity === "warning"
          ? "#f59e0b"
          : "#3b82f6";

    const payload = {
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.message,
          fields: [
            {
              title: "嚴重程度",
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: "租戶 ID",
              value: tenant.id,
              short: true,
            },
          ],
          footer: "MakanMakan 監控系統",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    try {
      await fetch(this.env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to send Slack notification:", error);
    }
  }

  /**
   * 解除告警
   */
  async resolveAlerts(tenantId: string, type: string): Promise<void> {
    // 在實際實現中，這會更新資料庫中的告警狀態
    console.log(`Resolving ${type} alerts for tenant ${tenantId}`);
  }

  /**
   * 獲取活躍告警
   */
  async getActiveAlerts(_tenantId?: string): Promise<Alert[]> {
    // 在實際實現中，這會從資料庫獲取告警
    return [];
  }

  /**
   * 確認告警
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    // 在實際實現中，這會更新告警狀態
    console.log(`Acknowledging alert ${alertId}`);
  }
}
