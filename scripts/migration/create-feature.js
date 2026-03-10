#!/usr/bin/env node

/**
 * Feature Creation Script
 * Automatically creates a new feature module from template
 *
 * Usage: node scripts/migration/create-feature.js --name=my-feature --type=simple
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

args.forEach((arg) => {
  if (arg.startsWith("--")) {
    const [key, value] = arg.substring(2).split("=");
    options[key] = value;
  }
});

// Validate required options
if (!options.name) {
  console.error("❌ Error: --name is required");
  console.log(
    "Usage: node scripts/migration/create-feature.js --name=my-feature --type=simple",
  );
  process.exit(1);
}

const featureName = options.name;
const featureType = options.type || "simple";

// Validate feature name
if (!/^[a-z-]+$/.test(featureName)) {
  console.error(
    '❌ Error: Feature name must be lowercase with hyphens only (e.g., "my-feature")',
  );
  process.exit(1);
}

// Helper functions for name transformations
const toPascalCase = (str) =>
  str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

const toCamelCase = (str) => {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
};

const toUpperCase = (str) => str.toUpperCase().replace(/-/g, "_");

const transformations = {
  "{{FEATURE_NAME}}": featureName,
  "{{FEATURE_NAME_KEBAB}}": featureName,
  "{{FEATURE_NAME_PASCAL}}": toPascalCase(featureName),
  "{{FEATURE_NAME_CAMEL}}": toCamelCase(featureName),
  "{{FEATURE_NAME_UPPER}}": toUpperCase(featureName),
};

// Paths
const templatePath = path.join(
  __dirname,
  "../../apps/api/src/shared/templates/feature-template",
);
const featuresPath = path.join(__dirname, "../../apps/api/src/features");
const targetPath = path.join(featuresPath, featureName);

console.log(`🚀 Creating feature module: ${featureName}`);
console.log(`📁 Target path: ${targetPath}`);

// Check if feature already exists
if (fs.existsSync(targetPath)) {
  console.error(`❌ Error: Feature "${featureName}" already exists`);
  process.exit(1);
}

// Check if template exists
if (!fs.existsSync(templatePath)) {
  console.error("❌ Error: Template directory not found");
  console.log(`Expected: ${templatePath}`);
  process.exit(1);
}

// Copy template directory
function copyTemplate(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const items = fs.readdirSync(src);

  items.forEach((item) => {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    if (fs.statSync(srcPath).isDirectory()) {
      copyTemplate(srcPath, destPath);
    } else {
      // Read file content
      let content = fs.readFileSync(srcPath, "utf8");

      // Apply transformations
      Object.entries(transformations).forEach(([placeholder, replacement]) => {
        content = content.replace(new RegExp(placeholder, "g"), replacement);
      });

      // Transform filename if needed
      let finalDestPath = destPath;
      Object.entries(transformations).forEach(([placeholder, replacement]) => {
        finalDestPath = finalDestPath.replace(
          new RegExp(placeholder, "g"),
          replacement,
        );
      });

      // Write transformed content
      fs.writeFileSync(finalDestPath, content);
    }
  });
}

try {
  // Create the feature module
  copyTemplate(templatePath, targetPath);

  // Create package.json scripts entry
  const packageJsonPath = path.join(__dirname, "../../package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    // Add feature-specific scripts
    packageJson.scripts[`test:${featureName}`] =
      `cd apps/api && npm run test -- src/features/${featureName}`;
    packageJson.scripts[`build:${featureName}`] =
      `cd apps/api && npm run build`;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log("📝 Updated package.json with feature scripts");
  }

  console.log("✅ Feature module created successfully!");
  console.log("\n📋 Next steps:");
  console.log(`1. Review the generated files in: ${targetPath}`);
  console.log(`2. Implement your business logic in: ${targetPath}/services/`);
  console.log(`3. Update database queries and types as needed`);
  console.log(`4. Add the feature to your main router`);
  console.log(`5. Run tests: npm run test:${featureName}`);
  console.log("\n🔗 Don't forget to:");
  console.log("- Update shared/constants/index.ts with your feature name");
  console.log("- Add cache keys to core/cache/index.ts if needed");
  console.log("- Register the feature routes in your main app");
} catch (error) {
  console.error("❌ Error creating feature module:", error.message);

  // Cleanup on error
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }

  process.exit(1);
}
