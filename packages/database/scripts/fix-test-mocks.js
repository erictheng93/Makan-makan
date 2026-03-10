/**
 * Script to automatically fix test mock structures
 * Converts old nested mock patterns to use createQueryChain helper
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path");

const TEST_FILES = [
  "src/services/__tests__/LeaveService.test.ts",
  "src/services/__tests__/SchedulingService.test.ts",
];

function fixMockStructure(content) {
  let fixed = content;

  // Pattern 1: Simple select mock
  // FROM: mockDb.select.mockReturnValue({ from: ..., where: ... })
  // TO: mockDb.select.mockReturnValue(createQueryChain(...))

  // Pattern 1a: select().from().where().resolvedValue(data)
  fixed = fixed.replace(
    /mockDb\.select\.mockReturnValue\(\{\s*from:\s*vi\.fn\(\)\.mockReturnValue\(\{\s*where:\s*vi\.fn\(\)\.mockResolvedValue\(([^)]+)\),?\s*\}\),?\s*\}\)/gs,
    "mockDb.select.mockReturnValue(createQueryChain($1))",
  );

  // Pattern 1b: select().from().where().orderBy().resolvedValue(data)
  fixed = fixed.replace(
    /mockDb\.select\.mockReturnValue\(\{\s*from:\s*vi\.fn\(\)\.mockReturnValue\(\{\s*where:\s*vi\.fn\(\)\.mockReturnValue\(\{\s*orderBy:\s*vi\.fn\(\)\.mockResolvedValue\(([^)]+)\),?\s*\}\),?\s*\}\),?\s*\}\)/gs,
    "mockDb.select.mockReturnValue(createQueryChain($1))",
  );

  // Pattern 1c: select().from().leftJoin().where().resolvedValue(data)
  fixed = fixed.replace(
    /mockDb\.select\.mockReturnValue\(\{\s*from:\s*vi\.fn\(\)\.mockReturnValue\(\{\s*leftJoin:\s*vi\.fn\(\)\.mockReturnValue\(\{\s*where:\s*vi\.fn\(\)\.mockResolvedValue\(([^)]+)\),?\s*\}\),?\s*\}\),?\s*\}\)/gs,
    "mockDb.select.mockReturnValue(createQueryChain($1))",
  );

  // Pattern 2: Update mock with returning
  // FROM: mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(...) }) }) })
  // TO: mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue(createQueryChain(...)) })
  fixed = fixed.replace(
    /mockDb\.update\.mockReturnValue\(\{\s*set:\s*vi\.fn\(\)\.mockReturnValue\(\{\s*where:\s*vi\.fn\(\)\.mockReturnValue\(\{\s*returning:\s*vi\.fn\(\)\.mockResolvedValue\(([^)]+)\),?\s*\}\),?\s*\}\),?\s*\}\)/gs,
    "mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue(createQueryChain($1)) })",
  );

  // Pattern 3: Update mock without returning
  // FROM: mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) })
  // TO: mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue(createQueryChain([])) })
  fixed = fixed.replace(
    /mockDb\.update\.mockReturnValue\(\{\s*set:\s*vi\.fn\(\)\.mockReturnValue\(\{\s*where:\s*vi\.fn\(\)\.mockResolvedValue\(undefined\),?\s*\}\),?\s*\}\)/gs,
    "mockDb.update.mockReturnValue({ set: vi.fn().mockReturnValue(createQueryChain([])) })",
  );

  // Pattern 4: Select with complex joins
  // FROM: mockDb.select.mockReturnValue({ from: ..., leftJoin: ..., where: ..., limit: ... })
  // This is too complex for simple regex, will need manual fixing

  return fixed;
}

function processFile(filePath) {
  const fullPath = path.join(__dirname, "..", filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⏭️  Skipping ${filePath} (not found)`);
    return;
  }

  console.log(`📝 Processing ${filePath}...`);

  const content = fs.readFileSync(fullPath, "utf8");
  const fixed = fixMockStructure(content);

  if (content === fixed) {
    console.log(`   ✓ No changes needed`);
    return;
  }

  // Create backup
  fs.writeFileSync(`${fullPath}.backup`, content);

  // Write fixed content
  fs.writeFileSync(fullPath, fixed);

  const originalLines = content.split("\n").length;
  const fixedLines = fixed.split("\n").length;
  const diff = fixedLines - originalLines;

  console.log(`   ✓ Fixed! (${diff > 0 ? "+" : ""}${diff} lines)`);
  console.log(`   📦 Backup saved to ${filePath}.backup`);
}

console.log("🔧 Fixing test mock structures...\n");

TEST_FILES.forEach(processFile);

console.log("\n✅ Done! Please review changes and run tests.");
console.log("💡 Tip: Use git diff to review changes");
console.log("🔄 To restore: mv *.backup original_name");
