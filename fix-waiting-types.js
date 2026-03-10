const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "packages",
  "database",
  "src",
  "services",
  "WaitingListService.ts",
);
let content = fs.readFileSync(filePath, "utf8");

// Add 'as any' to all db.get() calls
content = content.replace(
  /(await this\.db\.get\(sql`[^`]+`\));/g,
  "$1 as any;",
);
content = content.replace(
  /(await this\.db\.get\(sql\.raw\(`[\s\S]*?`[^)]*\)\));/g,
  "$1 as any;",
);

// Add 'as any[]' to db.all() calls
content = content.replace(
  /(await this\.db\.all\(sql`[^`]+`\));/g,
  "$1 as any[];",
);
content = content.replace(
  /(await this\.db\.all\(sql\.raw\(`[\s\S]*?`[^)]*\)\));/g,
  "$1 as any[];",
);

fs.writeFileSync(filePath, content, "utf8");
console.log("Fixed WaitingListService.ts type errors");
