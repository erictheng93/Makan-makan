#!/usr/bin/env npx tsx
/**
 * MakanMasak Security Setup Script
 * Cross-platform TypeScript version
 *
 * Usage: npx tsx scripts/setup-secrets.ts [--kv-only] [--help]
 * Purpose: Set up secure environment variables and secrets for all environments
 */

import { spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "fs";
import { createInterface } from "readline";
import { randomBytes } from "crypto";

// ANSI colors for terminal output
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
};

// Readline interface for interactive prompts
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function promptYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(`${question} (y/n): `, (answer) => {
      resolve(answer.toLowerCase().startsWith("y"));
    });
  });
}

function runCommand(
  command: string,
  args: string[],
  silent = false,
): { success: boolean; output: string } {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    stdio: silent ? "pipe" : "inherit",
    shell: false,
  });

  return {
    success: result.status === 0,
    output: result.stdout || "",
  };
}

function runWrangler(
  args: string[],
  silent = false,
): { success: boolean; output: string } {
  const wranglerCmd =
    process.platform === "win32" ? "wrangler.cmd" : "wrangler";

  // Try direct wrangler first, fallback to npx
  let result = runCommand(wranglerCmd, args, silent);
  if (!result.success) {
    const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
    result = runCommand(npxCmd, ["wrangler", ...args], silent);
  }

  return result;
}

function generateSecret(): string {
  return randomBytes(48).toString("base64");
}

async function setSecret(
  secretName: string,
  secretValue: string,
  env: string,
): Promise<void> {
  console.log(colors.yellow(`Setting ${secretName} for ${env} environment...`));

  if (env === "local") {
    // Append to .env.local
    const envFile = ".env.local";
    let content = existsSync(envFile) ? readFileSync(envFile, "utf-8") : "";

    if (content.includes(`${secretName}=`)) {
      // Update existing
      content = content.replace(
        new RegExp(`${secretName}=.*`, "g"),
        `${secretName}=${secretValue}`,
      );
    } else {
      // Append new
      content += `\n${secretName}=${secretValue}`;
    }

    writeFileSync(envFile, content.trim() + "\n");
    console.log(colors.green(`✅ Added ${secretName} to .env.local`));
  } else {
    // Use wrangler secret put with stdin
    const wranglerCmd =
      process.platform === "win32" ? "wrangler.cmd" : "wrangler";
    const result = spawnSync(
      wranglerCmd,
      ["secret", "put", secretName, "--env", env],
      {
        input: secretValue,
        encoding: "utf-8",
        stdio: ["pipe", "inherit", "inherit"],
      },
    );

    if (result.status === 0) {
      console.log(colors.green(`✅ Set ${secretName} for ${env}`));
    } else {
      console.log(colors.red(`❌ Failed to set ${secretName} for ${env}`));
    }
  }
}

async function createKvNamespaces(): Promise<void> {
  console.log(colors.blue("🗄️  Creating KV Namespaces..."));

  const namespaces = ["TOKEN_BLACKLIST", "CACHE_KV"];
  const environments = [""]; // '' = development

  for (const namespace of namespaces) {
    for (const env of environments) {
      const envLabel = env || "development";
      console.log(`Creating ${envLabel} ${namespace} namespace...`);

      const args = ["kv:namespace", "create", namespace];
      if (env) {
        args.push("--env", env);
      }

      runWrangler(args, true);
    }
  }

  // Production namespaces
  const createProd = await promptYesNo("🚨 Create production KV namespaces?");
  if (createProd) {
    for (const namespace of namespaces) {
      console.log(`Creating production ${namespace} namespace...`);
      runWrangler(
        ["kv:namespace", "create", namespace, "--env", "production"],
        true,
      );
    }
  }

  console.log(colors.green("✅ KV namespaces created"));
  console.log(
    colors.yellow(
      "💡 Don't forget to update the namespace IDs in wrangler.toml",
    ),
  );
}

async function mainSetup(): Promise<void> {
  console.log(colors.blue("🛡️  MakanMasak Security Setup"));
  console.log("================================================");
  console.log();

  // Check if wrangler is available
  const whoami = runWrangler(["whoami"], true);
  if (!whoami.success) {
    console.log(
      colors.yellow("⚠️  Wrangler not logged in. Some features may not work."),
    );
    console.log("Run: npx wrangler login");
    console.log();
  } else {
    console.log(colors.green("✅ Prerequisites check passed"));
    console.log();
  }

  console.log(colors.blue("🔑 Setting up JWT secrets..."));

  // Generate JWT secrets for each environment
  const jwtSecretDev = generateSecret();
  const jwtSecretProd = generateSecret();

  console.log(
    colors.yellow("Generated unique JWT secrets for all environments"),
  );
  console.log();

  // Create/update .env.local for development
  if (!existsSync(".env.local")) {
    if (existsSync(".env.example")) {
      copyFileSync(".env.example", ".env.local");
      console.log(colors.green("✅ Created .env.local from template"));
    } else {
      writeFileSync(".env.local", "# MakanMasak Local Environment\n");
      console.log(colors.green("✅ Created new .env.local"));
    }
  }

  // Update JWT_SECRET in .env.local
  await setSecret("JWT_SECRET", jwtSecretDev, "local");

  console.log();

  // Set production secrets
  const setupProduction = await promptYesNo(
    "🚨 Do you want to set up PRODUCTION environment secrets?",
  );
  if (setupProduction) {
    console.log(
      colors.red("⚠️  Setting up PRODUCTION secrets. Please be careful!"),
    );
    const confirm = await prompt("Are you sure? (yes/no): ");

    if (confirm === "yes") {
      await setSecret("JWT_SECRET", jwtSecretProd, "production");

      const slackUrlProd = await prompt(
        "📧 Enter Slack webhook URL for production (or press Enter to skip): ",
      );
      if (slackUrlProd) {
        await setSecret("SLACK_WEBHOOK_URL", slackUrlProd, "production");
      }

      const dbPasswordProd = await prompt(
        "🔐 Enter production database password (or press Enter to skip): ",
      );
      if (dbPasswordProd) {
        await setSecret("DB_PASSWORD", dbPasswordProd, "production");
      }
    } else {
      console.log(colors.yellow("⏭️  Skipped production setup"));
    }
  }

  console.log();
  console.log(colors.blue("📝 Next Steps:"));
  console.log("1. Update your database password in .env.local");
  console.log("2. Create Cloudflare KV namespaces:");
  console.log("   wrangler kv:namespace create 'TOKEN_BLACKLIST'");
  console.log("   wrangler kv:namespace create 'CACHE_KV'");
  console.log("3. Update wrangler.toml with the KV namespace IDs");
  console.log("4. Run database migrations:");
  console.log(
    "   npx wrangler d1 migrations apply makanmakan-prod --env production",
  );
  console.log("5. Test your setup with: pnpm run dev");

  console.log();
  console.log(colors.green("🎉 Security setup completed!"));
  console.log(colors.yellow("💡 Remember to:"));
  console.log("   - Never commit .env.local to version control");
  console.log("   - Rotate secrets regularly (quarterly)");
  console.log("   - Monitor your applications for security issues");

  // Ask if user wants to create KV namespaces
  console.log();
  const createKv = await promptYesNo(
    "🗄️  Do you want to create KV namespaces now?",
  );
  if (createKv) {
    await createKvNamespaces();
  }

  console.log();
  console.log(
    colors.green(
      "🔒 Setup complete! Your MakanMasak application is now secured.",
    ),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    console.log("Usage: npx tsx scripts/setup-secrets.ts [--kv-only] [--help]");
    console.log();
    console.log("Options:");
    console.log("  --kv-only    Only create KV namespaces");
    console.log("  --help       Show this help message");
    process.exit(0);
  }

  if (args.includes("--kv-only")) {
    await createKvNamespaces();
    rl.close();
    process.exit(0);
  }

  await mainSetup();
  rl.close();
}

main().catch((error) => {
  console.error(colors.red("Setup failed:"), error.message);
  rl.close();
  process.exit(1);
});
