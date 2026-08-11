#!/usr/bin/env npx tsx
/**
 * Tenant Deployment Script
 * 租戶部署自動化腳本
 *
 * Usage:
 *   npx tsx scripts/deploy-tenant.ts --tenant-id <id> --version <version>
 *   npx tsx scripts/deploy-tenant.ts --all --version <version>
 */

import { parseArgs } from "util";

const MANAGEMENT_API_URL =
  process.env.MANAGEMENT_API_URL || "http://localhost:8790/api/v1";

interface DeploymentResult {
  tenantId: string;
  success: boolean;
  deploymentId?: string;
  error?: string;
}

async function deployTenant(
  tenantId: string,
  version?: string,
): Promise<DeploymentResult> {
  console.log(`\n📦 Deploying tenant: ${tenantId}`);

  try {
    const response = await fetch(`${MANAGEMENT_API_URL}/deployments/deploy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantId,
        version,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log(`   ✅ Deployment started: ${data.data.id}`);
      return {
        tenantId,
        success: true,
        deploymentId: data.data.id,
      };
    } else {
      console.log(`   ❌ Deployment failed: ${data.error}`);
      return {
        tenantId,
        success: false,
        error: data.error,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.log(`   ❌ Error: ${message}`);
    return {
      tenantId,
      success: false,
      error: message,
    };
  }
}

async function getAllActiveTenants(): Promise<string[]> {
  try {
    const response = await fetch(`${MANAGEMENT_API_URL}/tenants?status=active`);
    const data = await response.json();

    if (data.success && data.data) {
      return data.data.map((t: { id: string }) => t.id);
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch tenants:", error);
    return [];
  }
}

async function batchDeploy(
  tenantIds: string[],
  version: string,
): Promise<void> {
  console.log(
    `\n📦 Batch deploying ${tenantIds.length} tenants to v${version}`,
  );

  try {
    const response = await fetch(`${MANAGEMENT_API_URL}/deployments/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tenantIds,
        version,
      }),
    });

    const data = await response.json();

    if (data.success) {
      console.log(`\n✅ Batch deployment queued:`);
      console.log(`   - Queued: ${data.data.queued}`);
      console.log(`   - Failed: ${data.data.failed.length}`);
      if (data.data.failed.length > 0) {
        console.log(`   - Failed IDs: ${data.data.failed.join(", ")}`);
      }
    } else {
      console.log(`\n❌ Batch deployment failed: ${data.error}`);
    }
  } catch (error) {
    console.error("Batch deployment error:", error);
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "tenant-id": { type: "string" },
      all: { type: "boolean" },
      version: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(`
🚀 MakanMasak Tenant Deployment Script

Usage:
  npx tsx scripts/deploy-tenant.ts [options]

Options:
  --tenant-id <id>   Deploy specific tenant
  --all              Deploy all active tenants
  --version <ver>    Target version (e.g., "1.2.0")
  -h, --help         Show this help

Examples:
  # Deploy single tenant
  npx tsx scripts/deploy-tenant.ts --tenant-id tenant-123 --version 1.2.0

  # Deploy all tenants
  npx tsx scripts/deploy-tenant.ts --all --version 1.2.0
`);
    return;
  }

  if (!values.version) {
    console.error("❌ Error: --version is required");
    process.exit(1);
  }

  if (values.all) {
    console.log("🔍 Fetching all active tenants...");
    const tenantIds = await getAllActiveTenants();

    if (tenantIds.length === 0) {
      console.log("No active tenants found.");
      return;
    }

    console.log(`Found ${tenantIds.length} active tenants.`);
    await batchDeploy(tenantIds, values.version);
  } else if (values["tenant-id"]) {
    await deployTenant(values["tenant-id"], values.version);
  } else {
    console.error("❌ Error: Specify --tenant-id or --all");
    process.exit(1);
  }

  console.log("\n✨ Done!");
}

main().catch(console.error);
