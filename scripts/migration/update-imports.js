#!/usr/bin/env node

/**
 * Import Path Update Script
 * Updates import paths when migrating to feature modules
 *
 * Usage: node scripts/migration/update-imports.js --from="routes/" --to="features/"
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
if (!options.from || !options.to) {
  console.error("❌ Error: --from and --to are required");
  console.log(
    'Usage: node scripts/migration/update-imports.js --from="routes/" --to="features/"',
  );
  process.exit(1);
}

const fromPattern = options.from;
const toPattern = options.to;
const isDryRun = process.argv.includes("--dry-run");

console.log(`🔄 Updating import paths from "${fromPattern}" to "${toPattern}"`);
console.log(`🧪 Dry run mode: ${isDryRun}`);

// Find all TypeScript files in the project
const apiSrcPath = path.join(__dirname, "../../apps/api/src");

function findTSFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach((item) => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (
        stat.isDirectory() &&
        !item.startsWith(".") &&
        item !== "node_modules"
      ) {
        traverse(fullPath);
      } else if (item.endsWith(".ts") || item.endsWith(".tsx")) {
        files.push(fullPath);
      }
    });
  }

  traverse(dir);
  return files;
}

const tsFiles = findTSFiles(apiSrcPath);
console.log(`📁 Found ${tsFiles.length} TypeScript files to process`);

// Statistics
const stats = {
  filesProcessed: 0,
  filesChanged: 0,
  importsUpdated: 0,
  errors: 0,
};

// Process each file
tsFiles.forEach((filePath) => {
  try {
    stats.filesProcessed++;

    const relativePath = path.relative(apiSrcPath, filePath);
    const content = fs.readFileSync(filePath, "utf8");

    // Escape user-provided pattern for safe regex construction
    const escapedFromPattern = fromPattern.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    // Find import statements that match the pattern
    const importRegex = new RegExp(
      `import\\s+.*?from\\s+['"\`]([^'"\`]*${escapedFromPattern}[^'"\`]*)['"\`]`,
      "gm",
    );

    let updatedContent = content;
    let fileChanged = false;
    let match;

    const changesInFile = [];

    while ((match = importRegex.exec(content)) !== null) {
      const originalImport = match[0];
      const importPath = match[1];

      // Replace the pattern in the import path
      const newImportPath = importPath.replace(
        new RegExp(escapedFromPattern, "g"),
        toPattern,
      );

      if (newImportPath !== importPath) {
        const newImport = originalImport.replace(importPath, newImportPath);
        updatedContent = updatedContent.replace(originalImport, newImport);

        changesInFile.push({
          original: originalImport,
          updated: newImport,
          line: content.substring(0, match.index).split("\\n").length,
        });

        fileChanged = true;
        stats.importsUpdated++;
      }
    }

    if (fileChanged) {
      stats.filesChanged++;

      console.log(`📝 ${relativePath}`);
      changesInFile.forEach((change) => {
        console.log(`   Line ${change.line}:`);
        console.log(`     - ${change.original.trim()}`);
        console.log(`     + ${change.updated.trim()}`);
      });

      // Write the updated content (unless dry run)
      if (!isDryRun) {
        // Create backup
        const backupPath = filePath + ".backup";
        fs.writeFileSync(backupPath, content);

        // Write updated file
        fs.writeFileSync(filePath, updatedContent);
      }
    }
  } catch (error) {
    stats.errors++;
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
});

// Report statistics
console.log("\\n📊 Update Statistics:");
console.log(`   Files processed: ${stats.filesProcessed}`);
console.log(`   Files changed: ${stats.filesChanged}`);
console.log(`   Imports updated: ${stats.importsUpdated}`);
console.log(`   Errors: ${stats.errors}`);

if (isDryRun) {
  console.log("\\n🧪 This was a dry run. No files were actually modified.");
  console.log("   Remove --dry-run to apply the changes.");
} else if (stats.filesChanged > 0) {
  console.log("\\n💾 Backup files created with .backup extension");
  console.log("   You can restore them if needed.");

  console.log("\\n🔍 Recommended next steps:");
  console.log("1. Test your application to ensure imports work correctly");
  console.log("2. Run TypeScript compiler to check for errors");
  console.log("3. Remove .backup files when satisfied with changes");

  // Offer to run TypeScript check
  console.log("\\n❓ Run TypeScript check now? (Run with --check-types)");
  if (process.argv.includes("--check-types")) {
    console.log("🔍 Running TypeScript check...");
    try {
      execSync("cd apps/api && npx tsc --noEmit", { stdio: "inherit" });
      console.log("✅ TypeScript check passed!");
    } catch {
      console.error(
        "❌ TypeScript check failed. You may need to fix import paths manually.",
      );
    }
  }
}

// Generate cleanup script
if (!isDryRun && stats.filesChanged > 0) {
  const cleanupScript = `#!/bin/bash
# Cleanup backup files generated by import path update
echo "🧹 Cleaning up backup files..."

find apps/api/src -name "*.backup" -type f | while read file; do
  echo "Removing: $file"
  rm "$file"
done

echo "✅ Backup files cleaned up!"
`;

  fs.writeFileSync(path.join(__dirname, "cleanup-backups.sh"), cleanupScript);
  console.log(
    "\\n🧹 Cleanup script generated: scripts/migration/cleanup-backups.sh",
  );
}
