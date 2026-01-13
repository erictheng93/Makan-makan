#!/usr/bin/env npx tsx
/**
 * Health Check Script
 * 健康檢查自動化腳本
 *
 * Usage:
 *   npx tsx scripts/health-check.ts
 *   npx tsx scripts/health-check.ts --tenant-id <id>
 */

import { parseArgs } from "util";

const MANAGEMENT_API_URL =
  process.env.MANAGEMENT_API_URL || "http://localhost:8790/api/v1";

interface HealthStatus {
  tenantId: string;
  businessName: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  responseTimeMs?: number;
}

async function checkAllHealth(): Promise<HealthStatus[]> {
  try {
    const response = await fetch(`${MANAGEMENT_API_URL}/health/tenants`);
    const data = await response.json();

    if (data.success && data.data) {
      return data.data;
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch health status:", error);
    return [];
  }
}

async function checkTenantHealth(tenantId: string): Promise<void> {
  console.log(`\n🔍 Checking health for tenant: ${tenantId}`);

  try {
    const response = await fetch(
      `${MANAGEMENT_API_URL}/health/check/${tenantId}`,
      { method: "POST" },
    );
    const data = await response.json();

    if (data.success && data.data) {
      const check = data.data;
      const statusEmoji =
        check.status === "healthy"
          ? "✅"
          : check.status === "degraded"
            ? "⚠️"
            : "❌";

      console.log(`\n${statusEmoji} Status: ${check.status.toUpperCase()}`);
      console.log(`   Response Time: ${check.responseTimeMs || "N/A"}ms`);

      if (check.details) {
        console.log("\n   Components:");
        Object.entries(check.details).forEach(([key, value]) => {
          const emoji =
            value === "healthy" ? "✅" : value === "degraded" ? "⚠️" : "❌";
          console.log(`     ${emoji} ${key}: ${value}`);
        });
      }
    } else {
      console.log(`\n❌ Health check failed: ${data.error}`);
    }
  } catch (error) {
    console.error("Health check error:", error);
  }
}

function printStatusReport(statuses: HealthStatus[]): void {
  console.log("\n📊 Health Status Report");
  console.log("═".repeat(60));

  const healthy = statuses.filter((s) => s.status === "healthy");
  const degraded = statuses.filter((s) => s.status === "degraded");
  const down = statuses.filter((s) => s.status === "down");

  console.log(`\n   ✅ Healthy:  ${healthy.length}`);
  console.log(`   ⚠️  Degraded: ${degraded.length}`);
  console.log(`   ❌ Down:     ${down.length}`);
  console.log(`   📈 Total:    ${statuses.length}`);

  if (down.length > 0) {
    console.log("\n🚨 DOWN Tenants:");
    down.forEach((s) => {
      console.log(`   - ${s.businessName} (${s.tenantId})`);
    });
  }

  if (degraded.length > 0) {
    console.log("\n⚠️  DEGRADED Tenants:");
    degraded.forEach((s) => {
      console.log(
        `   - ${s.businessName} (${s.tenantId}) - ${s.responseTimeMs || "?"}ms`,
      );
    });
  }

  console.log("\n" + "═".repeat(60));
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "tenant-id": { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(`
🏥 MakanMakan Health Check Script

Usage:
  npx tsx scripts/health-check.ts [options]

Options:
  --tenant-id <id>   Check specific tenant
  --json             Output as JSON
  -h, --help         Show this help

Examples:
  # Check all tenants
  npx tsx scripts/health-check.ts

  # Check specific tenant
  npx tsx scripts/health-check.ts --tenant-id tenant-123

  # Output as JSON for automation
  npx tsx scripts/health-check.ts --json
`);
    return;
  }

  if (values["tenant-id"]) {
    await checkTenantHealth(values["tenant-id"]);
  } else {
    console.log("🔍 Checking health for all tenants...");
    const statuses = await checkAllHealth();

    if (values.json) {
      console.log(JSON.stringify(statuses, null, 2));
    } else {
      printStatusReport(statuses);
    }
  }

  console.log("\n✨ Done!");
}

main().catch(console.error);
