#!/usr/bin/env node

/**
 * Factory Usage Tracker
 *
 * 追踪 testing-utils factory 的使用情況
 * 生成使用報告和統計數據
 */

const fs = require("fs");
const path = require("path");

// 配置
const CONFIG = {
  // 要掃描的目錄
  scanDirs: [
    "apps/api/src/**/__tests__/**/*.test.ts",
    "apps/admin-dashboard/src/**/*.test.ts",
    "apps/customer-app/src/**/*.test.ts",
    "apps/kitchen-display/src/**/*.test.ts",
    "packages/*/src/**/*.test.ts",
  ],

  // Factory 模式
  factoryPatterns: {
    userFactory:
      /userFactory\.(build|buildList|buildAdmin|buildShopOwner|buildChef|buildServiceCrew|buildCashier|buildCustomer|buildRestaurantTeam)/g,
    restaurantFactory:
      /restaurantFactory\.(build|buildList|buildWithShopMode|buildFastFood|buildFineDining|buildCafe)/g,
    categoryFactory:
      /categoryFactory\.(build|buildList|buildRestaurantCategories)/g,
    menuItemFactory:
      /menuItemFactory\.(build|buildList|buildForCategory|buildPopular|buildOnSale|buildVegetarian)/g,
    orderFactory:
      /orderFactory\.(build|buildList|buildPending|buildInProgress|buildCompleted|buildTakeaway|buildDelivery)/g,
    orderItemFactory:
      /orderItemFactory\.(build|buildList|buildForOrder|buildPrepared|buildServed)/g,
    buildCompleteRestaurantData: /buildCompleteRestaurantData\(/g,
    resetAllFactories: /resetAllFactories\(/g,
  },

  // 輸出路徑
  outputDir: "reports/factory-usage",
};

/**
 * 掃描文件獲取所有測試文件
 */
function getTestFiles() {
  const glob = require("glob");
  const files = [];

  CONFIG.scanDirs.forEach((pattern) => {
    const matches = glob.sync(pattern, {
      ignore: ["**/node_modules/**", "**/dist/**", "**/build/**"],
      absolute: true,
    });
    files.push(...matches);
  });

  return files;
}

/**
 * 分析單個文件
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const relativePath = path.relative(process.cwd(), filePath);

  const stats = {
    file: relativePath,
    hasFactoryImport: false,
    hasResetCall: false,
    factoryUsage: {},
    totalFactoryCalls: 0,
    lineCount: content.split("\n").length,
  };

  // 檢查是否導入 factory
  stats.hasFactoryImport = /@makanmasak\/testing-utils/.test(content);

  // 統計每個 factory 的使用次數
  Object.entries(CONFIG.factoryPatterns).forEach(([name, pattern]) => {
    const matches = content.match(pattern) || [];
    if (matches.length > 0) {
      stats.factoryUsage[name] = matches.length;
      stats.totalFactoryCalls += matches.length;
    }
  });

  // 檢查是否有 resetAllFactories 調用
  stats.hasResetCall = stats.factoryUsage.resetAllFactories > 0;

  return stats;
}

/**
 * 生成統計報告
 */
function generateReport(fileStats) {
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalFiles: fileStats.length,
      filesUsingFactory: 0,
      filesWithReset: 0,
      totalFactoryCalls: 0,
      adoptionRate: 0,
    },
    factoryUsage: {},
    files: {
      usingFactory: [],
      notUsingFactory: [],
      missingReset: [],
    },
    topFactories: [],
  };

  // 計算統計數據
  fileStats.forEach((stats) => {
    if (stats.hasFactoryImport || stats.totalFactoryCalls > 0) {
      report.summary.filesUsingFactory++;
      report.files.usingFactory.push({
        file: stats.file,
        calls: stats.totalFactoryCalls,
        usage: stats.factoryUsage,
      });

      if (!stats.hasResetCall && stats.totalFactoryCalls > 0) {
        report.files.missingReset.push(stats.file);
      }
    } else {
      report.files.notUsingFactory.push(stats.file);
    }

    if (stats.hasResetCall) {
      report.summary.filesWithReset++;
    }

    report.summary.totalFactoryCalls += stats.totalFactoryCalls;

    // 累計每個 factory 的使用次數
    Object.entries(stats.factoryUsage).forEach(([factory, count]) => {
      report.factoryUsage[factory] =
        (report.factoryUsage[factory] || 0) + count;
    });
  });

  // 計算採用率
  report.summary.adoptionRate = (
    (report.summary.filesUsingFactory / report.summary.totalFiles) *
    100
  ).toFixed(2);

  // 排序最常用的 factories
  report.topFactories = Object.entries(report.factoryUsage)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return report;
}

/**
 * 生成 Markdown 報告
 */
function generateMarkdownReport(report) {
  const lines = [
    "# Factory 使用統計報告",
    "",
    `> 📊 生成時間: ${new Date(report.generatedAt).toLocaleString("zh-TW")}`,
    "",
    "---",
    "",
    "## 📈 總體統計",
    "",
    "```",
    `總測試文件數: ${report.summary.totalFiles}`,
    `使用 Factory 的文件: ${report.summary.filesUsingFactory}`,
    `採用率: ${report.summary.adoptionRate}%`,
    `有 resetAllFactories 的文件: ${report.summary.filesWithReset}`,
    `Factory 總調用次數: ${report.summary.totalFactoryCalls}`,
    "```",
    "",
    "### 📊 進度視覺化",
    "",
    "```",
    `Factory 採用率: ${"█".repeat(Math.floor(report.summary.adoptionRate / 2))}${"░".repeat(50 - Math.floor(report.summary.adoptionRate / 2))} ${report.summary.adoptionRate}%`,
    "```",
    "",
    "---",
    "",
    "## 🏆 最常用的 Factories",
    "",
    "| 排名 | Factory | 使用次數 |",
    "|------|---------|----------|",
  ];

  report.topFactories.forEach((factory, index) => {
    lines.push(`| ${index + 1} | \`${factory.name}\` | ${factory.count} |`);
  });

  lines.push(
    "",
    "---",
    "",
    "## ✅ 已使用 Factory 的文件",
    "",
    `總計: ${report.files.usingFactory.length} 個文件`,
    "",
  );

  report.files.usingFactory
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 20)
    .forEach((file, index) => {
      lines.push(`${index + 1}. \`${file.file}\` - ${file.calls} 次調用`);
    });

  if (report.files.usingFactory.length > 20) {
    lines.push(`\n... 還有 ${report.files.usingFactory.length - 20} 個文件`);
  }

  lines.push(
    "",
    "---",
    "",
    "## ⚠️ 未使用 Factory 的文件",
    "",
    `總計: ${report.files.notUsingFactory.length} 個文件`,
    "",
  );

  report.files.notUsingFactory.slice(0, 20).forEach((file, index) => {
    lines.push(`${index + 1}. \`${file}\``);
  });

  if (report.files.notUsingFactory.length > 20) {
    lines.push(`\n... 還有 ${report.files.notUsingFactory.length - 20} 個文件`);
  }

  lines.push(
    "",
    "---",
    "",
    "## ⚠️ 缺少 resetAllFactories 的文件",
    "",
    `總計: ${report.files.missingReset.length} 個文件`,
    "",
    "> 這些文件使用了 factory 但沒有調用 resetAllFactories()，可能導致測試數據 ID 不一致",
    "",
  );

  report.files.missingReset.forEach((file, index) => {
    lines.push(`${index + 1}. \`${file}\``);
  });

  lines.push(
    "",
    "---",
    "",
    "## 📋 建議行動",
    "",
    "### 優先級 P0 - 立即處理",
    "",
  );

  if (report.files.missingReset.length > 0) {
    lines.push(
      `- [ ] 為 ${report.files.missingReset.length} 個文件添加 \`resetAllFactories()\``,
    );
  }

  lines.push(
    "",
    "### 優先級 P1 - 本週處理",
    "",
    `- [ ] 遷移 ${Math.min(5, report.files.notUsingFactory.length)} 個未使用 factory 的文件`,
    "",
    "### 優先級 P2 - 本月處理",
    "",
    `- [ ] 達成 80% 採用率 (目前: ${report.summary.adoptionRate}%)`,
    "",
    "---",
    "",
    "**報告生成器**: `scripts/factory-usage-tracker.js`",
  );

  return lines.join("\n");
}

/**
 * 主函數
 */
function main() {
  console.log("🔍 開始掃描測試文件...");

  // 獲取所有測試文件
  const testFiles = getTestFiles();
  console.log(`📁 找到 ${testFiles.length} 個測試文件`);

  // 分析每個文件
  console.log("📊 分析文件中...");
  const fileStats = testFiles.map(analyzeFile);

  // 生成報告
  console.log("📝 生成報告...");
  const report = generateReport(fileStats);

  // 確保輸出目錄存在
  const outputDir = path.join(process.cwd(), CONFIG.outputDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 保存 JSON 報告
  const jsonPath = path.join(outputDir, "usage-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`✅ JSON 報告已保存: ${jsonPath}`);

  // 保存 Markdown 報告
  const mdPath = path.join(outputDir, "usage-report.md");
  const markdown = generateMarkdownReport(report);
  fs.writeFileSync(mdPath, markdown);
  console.log(`✅ Markdown 報告已保存: ${mdPath}`);

  // 顯示摘要
  console.log("\n📊 統計摘要:");
  console.log(`   總文件: ${report.summary.totalFiles}`);
  console.log(`   使用 Factory: ${report.summary.filesUsingFactory}`);
  console.log(`   採用率: ${report.summary.adoptionRate}%`);
  console.log(`   總調用次數: ${report.summary.totalFactoryCalls}`);

  if (report.files.missingReset.length > 0) {
    console.log(
      `\n⚠️  警告: ${report.files.missingReset.length} 個文件缺少 resetAllFactories()`,
    );
  }
}

// 執行
if (require.main === module) {
  main();
}

module.exports = { analyzeFile, generateReport, generateMarkdownReport };
