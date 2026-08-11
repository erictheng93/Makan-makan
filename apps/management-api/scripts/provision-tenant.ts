#!/usr/bin/env npx tsx
/**
 * Tenant Provisioning Script
 * 租戶資源配置自動化腳本
 *
 * Usage:
 *   npx tsx scripts/provision-tenant.ts --tenant-id <id>
 *   npx tsx scripts/provision-tenant.ts --create --name "Restaurant Name" --email "owner@email.com"
 */

import { parseArgs } from "util";

const MANAGEMENT_API_URL =
  process.env.MANAGEMENT_API_URL || "http://localhost:8790/api/v1";

interface TenantCreateRequest {
  businessName: string;
  contactEmail: string;
  contactPhone?: string;
  subdomain?: string;
  planId?: string;
}

async function createTenant(data: TenantCreateRequest): Promise<string | null> {
  console.log(`\n📝 Creating tenant: ${data.businessName}`);

  try {
    const response = await fetch(`${MANAGEMENT_API_URL}/tenants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (result.success && result.data) {
      console.log(`   ✅ Tenant created: ${result.data.id}`);
      return result.data.id;
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      return null;
    }
  } catch (error) {
    console.error("Error creating tenant:", error);
    return null;
  }
}

async function provisionTenant(tenantId: string): Promise<boolean> {
  console.log(`\n⚙️  Provisioning resources for tenant: ${tenantId}`);

  try {
    const response = await fetch(
      `${MANAGEMENT_API_URL}/deployments/provision`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tenantId }),
      },
    );

    const result = await response.json();

    if (result.success && result.data) {
      console.log(`\n   ✅ Resources provisioned:`);
      result.data.forEach(
        (resource: {
          resourceType: string;
          resourceName: string;
          status: string;
        }) => {
          const emoji = resource.status === "provisioned" ? "✅" : "⏳";
          console.log(
            `      ${emoji} ${resource.resourceType}: ${resource.resourceName}`,
          );
        },
      );
      return true;
    } else {
      console.log(`   ❌ Provisioning failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error("Provisioning error:", error);
    return false;
  }
}

async function deployTenant(tenantId: string): Promise<boolean> {
  console.log(`\n🚀 Deploying tenant: ${tenantId}`);

  try {
    const response = await fetch(`${MANAGEMENT_API_URL}/deployments/deploy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tenantId }),
    });

    const result = await response.json();

    if (result.success && result.data) {
      console.log(`   ✅ Deployment started: ${result.data.id}`);
      console.log(`   📦 Version: ${result.data.toVersion}`);
      return true;
    } else {
      console.log(`   ❌ Deployment failed: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error("Deployment error:", error);
    return false;
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "tenant-id": { type: "string" },
      create: { type: "boolean" },
      name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      subdomain: { type: "string" },
      plan: { type: "string" },
      deploy: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(`
🏗️  MakanMasak Tenant Provisioning Script

Usage:
  npx tsx scripts/provision-tenant.ts [options]

Options:
  --tenant-id <id>   Provision existing tenant
  --create           Create new tenant
  --name <name>      Business name (required with --create)
  --email <email>    Contact email (required with --create)
  --phone <phone>    Contact phone (optional)
  --subdomain <sub>  Preferred subdomain (optional)
  --plan <plan>      Plan ID: standard, professional, enterprise (default: standard)
  --deploy           Also deploy after provisioning
  -h, --help         Show this help

Examples:
  # Provision existing tenant
  npx tsx scripts/provision-tenant.ts --tenant-id tenant-123

  # Create and provision new tenant
  npx tsx scripts/provision-tenant.ts --create --name "御膳房" --email "owner@yushenfang.com" --plan professional

  # Create, provision, and deploy
  npx tsx scripts/provision-tenant.ts --create --name "御膳房" --email "owner@yushenfang.com" --deploy
`);
    return;
  }

  let tenantId = values["tenant-id"];

  // Create tenant if requested
  if (values.create) {
    if (!values.name || !values.email) {
      console.error("❌ Error: --name and --email are required with --create");
      process.exit(1);
    }

    tenantId = await createTenant({
      businessName: values.name,
      contactEmail: values.email,
      contactPhone: values.phone,
      subdomain: values.subdomain,
      planId: values.plan || "standard",
    });

    if (!tenantId) {
      process.exit(1);
    }
  }

  if (!tenantId) {
    console.error("❌ Error: Specify --tenant-id or --create");
    process.exit(1);
  }

  // Provision resources
  const provisioned = await provisionTenant(tenantId);
  if (!provisioned) {
    process.exit(1);
  }

  // Deploy if requested
  if (values.deploy) {
    const deployed = await deployTenant(tenantId);
    if (!deployed) {
      process.exit(1);
    }
  }

  console.log("\n✨ Done!");
  console.log(`\n📋 Summary:`);
  console.log(`   Tenant ID: ${tenantId}`);
  console.log(`   Provisioned: ✅`);
  console.log(`   Deployed: ${values.deploy ? "✅" : "⏳ Pending"}`);
}

main().catch(console.error);
