#!/usr/bin/env node

/**
 * Migration Progress Tracker
 *
 * 追踪測試文件遷移到 factory 的進度
 * 生成進度報告和視覺化圖表
 */

const fs = require("fs");
const path = require("path");

// 配置
const CONFIG = {
  // 遷移狀態文件
  statusFile: "reports/migration-status.json",

  // 輸出路徑
  outputDir: "reports/factory-migration",

  // 模組優先級定義
  modulePriorities: {
    // P0: 核心業務邏輯
    P0: ["orders", "group-orders", "payment"],

    // P1: 重要功能
    P1: ["menu", "restaurants", "users", "authentication"],

    // P2: 支援功能
    P2: ["tables", "coupons", "qr-codes", "kitchen", "cache"],

    // P3: 其他
    P3: ["monitoring", "realtime"],
  },
};

/**
 * 初始化遷移狀態
 */
function initMigrationStatus() {
  const statusPath = path.join(process.cwd(), CONFIG.statusFile);

  // 如果狀態文件已存在，讀取它
  if (fs.existsSync(statusPath)) {
    return JSON.parse(fs.readFileSync(statusPath, "utf-8"));
  }

  // 否則創建新的狀態
  return {
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
    modules: {},
    milestones: [
      {
        name: "試點完成",
        targetDate: "2025-11-22",
        completed: false,
        modules: ["users"],
      },
      {
        name: "核心模組完成",
        targetDate: "2025-12-06",
        completed: false,
        modules: ["users", "restaurants", "menu", "orders"],
      },
      {
        name: "80% 採用率",
        targetDate: "2025-12-20",
        completed: false,
        threshold: 0.8,
      },
    ],
  };
}

/**
 * 記錄模組遷移
 */
function recordModuleMigration(moduleName, data) {
  const status = initMigrationStatus();

  status.modules[moduleName] = {
    ...status.modules[moduleName],
    ...data,
    lastUpdated: new Date().toISOString(),
  };

  status.lastUpdated = new Date().toISOString();

  // 保存狀態
  const statusPath = path.join(process.cwd(), CONFIG.statusFile);
  const dir = path.dirname(statusPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));

  return status;
}

/**
 * 獲取模組優先級
 */
function getModulePriority(moduleName) {
  for (const [priority, modules] of Object.entries(CONFIG.modulePriorities)) {
    if (modules.includes(moduleName)) {
      return priority;
    }
  }
  return "P3";
}

/**
 * 計算整體進度
 */
function calculateProgress(status) {
  const modules = Object.values(status.modules);

  if (modules.length === 0) {
    return {
      overall: 0,
      byPriority: { P0: 0, P1: 0, P2: 0, P3: 0 },
      byStatus: {
        notStarted: 0,
        inProgress: 0,
        completed: 0,
      },
    };
  }

  const progress = {
    overall: 0,
    byPriority: { P0: 0, P1: 0, P2: 0, P3: 0 },
    byStatus: {
      notStarted: 0,
      inProgress: 0,
      completed: 0,
    },
  };

  // 統計各優先級的進度
  const priorityCounts = { P0: 0, P1: 0, P2: 0, P3: 0 };
  const priorityProgress = { P0: 0, P1: 0, P2: 0, P3: 0 };

  modules.forEach((module) => {
    const priority = getModulePriority(module.name);

    priorityCounts[priority]++;
    priorityProgress[priority] += module.progress || 0;

    // 統計狀態
    if (!module.status || module.status === "not-started") {
      progress.byStatus.notStarted++;
    } else if (module.status === "in-progress") {
      progress.byStatus.inProgress++;
    } else if (module.status === "completed") {
      progress.byStatus.completed++;
    }

    progress.overall += module.progress || 0;
  });

  // 計算平均值
  progress.overall = progress.overall / modules.length;

  Object.keys(priorityCounts).forEach((priority) => {
    if (priorityCounts[priority] > 0) {
      progress.byPriority[priority] =
        priorityProgress[priority] / priorityCounts[priority];
    }
  });

  return progress;
}

/**
 * 檢查里程碑
 */
function checkMilestones(status, progress) {
  status.milestones.forEach((milestone) => {
    if (milestone.completed) return;

    if (milestone.modules) {
      // 檢查指定模組是否都完成
      const allCompleted = milestone.modules.every(
        (moduleName) =>
          status.modules[moduleName] &&
          status.modules[moduleName].status === "completed",
      );
      milestone.completed = allCompleted;
    } else if (milestone.threshold) {
      // 檢查是否達到閾值
      milestone.completed = progress.overall / 100 >= milestone.threshold;
    }
  });
}

/**
 * 生成進度報告
 */
function generateProgressReport(status) {
  const progress = calculateProgress(status);
  checkMilestones(status, progress);

  const report = {
    generatedAt: new Date().toISOString(),
    lastUpdated: status.lastUpdated,
    progress,
    modules: Object.values(status.modules).map((module) => ({
      ...module,
      priority: getModulePriority(module.name),
    })),
    milestones: status.milestones,
    recommendations: [],
  };

  // 生成建議
  if (progress.overall < 30) {
    report.recommendations.push({
      priority: "high",
      message: "整體進度較低，建議加快試點模組遷移",
    });
  }

  const p0Progress = progress.byPriority.P0;
  if (p0Progress < progress.overall) {
    report.recommendations.push({
      priority: "high",
      message: "P0 核心模組進度落後於整體，建議優先處理",
    });
  }

  if (progress.byStatus.inProgress > 5) {
    report.recommendations.push({
      priority: "medium",
      message: `${progress.byStatus.inProgress} 個模組正在進行中，建議先完成再開始新的`,
    });
  }

  return report;
}

/**
 * 生成 Markdown 報告
 */
function generateMarkdownReport(report) {
  const lines = [
    "# Factory 遷移進度報告",
    "",
    `> 📊 生成時間: ${new Date(report.generatedAt).toLocaleString("zh-TW")}`,
    `> 🔄 最後更新: ${new Date(report.lastUpdated).toLocaleString("zh-TW")}`,
    "",
    "---",
    "",
    "## 📈 整體進度",
    "",
    "```",
    `整體完成度: ${report.progress.overall.toFixed(1)}%`,
    `已完成: ${report.progress.byStatus.completed} 個模組`,
    `進行中: ${report.progress.byStatus.inProgress} 個模組`,
    `未開始: ${report.progress.byStatus.notStarted} 個模組`,
    "```",
    "",
    "### 進度條",
    "",
    "```",
    `整體: ${"█".repeat(Math.floor(report.progress.overall / 2))}${"░".repeat(50 - Math.floor(report.progress.overall / 2))} ${report.progress.overall.toFixed(1)}%`,
    "```",
    "",
    "---",
    "",
    "## 🎯 各優先級進度",
    "",
    "| 優先級 | 進度 | 視覺化 |",
    "|--------|------|--------|",
  ];

  Object.entries(report.progress.byPriority).forEach(([priority, progress]) => {
    const bar =
      "█".repeat(Math.floor(progress / 5)) +
      "░".repeat(20 - Math.floor(progress / 5));
    lines.push(`| ${priority} | ${progress.toFixed(1)}% | \`${bar}\` |`);
  });

  lines.push("", "---", "", "## 📋 模組狀態", "");

  // 按優先級分組
  const modulesByPriority = {};
  report.modules.forEach((module) => {
    const priority = module.priority;
    if (!modulesByPriority[priority]) {
      modulesByPriority[priority] = [];
    }
    modulesByPriority[priority].push(module);
  });

  Object.entries(modulesByPriority)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([priority, modules]) => {
      lines.push(`### ${priority} 模組`, "");

      modules
        .sort((a, b) => (b.progress || 0) - (a.progress || 0))
        .forEach((module) => {
          const statusIcon =
            module.status === "completed"
              ? "✅"
              : module.status === "in-progress"
                ? "🔄"
                : "⏳";
          const progressBar = "█".repeat(
            Math.floor((module.progress || 0) / 5),
          );
          lines.push(
            `- ${statusIcon} **${module.name}** - ${module.progress || 0}% \`${progressBar}\``,
          );
          if (module.notes) {
            lines.push(`  - _${module.notes}_`);
          }
        });

      lines.push("");
    });

  lines.push(
    "---",
    "",
    "## 🎯 里程碑",
    "",
    "| 里程碑 | 目標日期 | 狀態 |",
    "|--------|----------|------|",
  );

  report.milestones.forEach((milestone) => {
    const status = milestone.completed ? "✅ 完成" : "⏳ 進行中";
    const targetDate = new Date(milestone.targetDate).toLocaleDateString(
      "zh-TW",
    );
    lines.push(`| ${milestone.name} | ${targetDate} | ${status} |`);
  });

  lines.push("", "---", "", "## 💡 建議行動", "");

  if (report.recommendations.length === 0) {
    lines.push("✅ 目前進度良好，保持當前節奏");
  } else {
    report.recommendations.forEach((rec) => {
      const icon = rec.priority === "high" ? "🔴" : "🟡";
      lines.push(`- ${icon} **${rec.priority.toUpperCase()}**: ${rec.message}`);
    });
  }

  lines.push(
    "",
    "---",
    "",
    "## 📊 統計圖表",
    "",
    "### 狀態分布",
    "",
    "```",
    `✅ 已完成: ${report.progress.byStatus.completed} (${((report.progress.byStatus.completed / report.modules.length) * 100).toFixed(1)}%)`,
    `🔄 進行中: ${report.progress.byStatus.inProgress} (${((report.progress.byStatus.inProgress / report.modules.length) * 100).toFixed(1)}%)`,
    `⏳ 未開始: ${report.progress.byStatus.notStarted} (${((report.progress.byStatus.notStarted / report.modules.length) * 100).toFixed(1)}%)`,
    "```",
    "",
    "---",
    "",
    "**報告生成器**: `scripts/migration-progress-tracker.js`",
  );

  return lines.join("\n");
}

/**
 * CLI 命令
 */
function cli() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "init":
      // 初始化狀態文件
      initMigrationStatus();
      console.log("✅ 遷移狀態已初始化");
      break;

    case "update":
      // 更新模組狀態
      const moduleName = args[1];
      const statusValue = args[2];
      const progress = parseInt(args[3]) || 0;

      if (!moduleName || !statusValue) {
        console.error(
          "❌ 使用方式: npm run migration:update <module> <status> [progress]",
        );
        console.error("   狀態: not-started | in-progress | completed");
        console.error("   範例: npm run migration:update users completed 100");
        process.exit(1);
      }

      recordModuleMigration(moduleName, {
        name: moduleName,
        status: statusValue,
        progress,
      });

      console.log(`✅ ${moduleName} 已更新: ${statusValue} (${progress}%)`);
      break;

    case "report":
      // 生成報告
      const migrationStatus = initMigrationStatus();
      const report = generateProgressReport(migrationStatus);

      // 確保輸出目錄存在
      const outputDir = path.join(process.cwd(), CONFIG.outputDir);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // 保存 JSON 報告
      const jsonPath = path.join(outputDir, "progress-report.json");
      fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

      // 保存 Markdown 報告
      const mdPath = path.join(outputDir, "progress-report.md");
      const markdown = generateMarkdownReport(report);
      fs.writeFileSync(mdPath, markdown);

      console.log("✅ 進度報告已生成");
      console.log(`   JSON: ${jsonPath}`);
      console.log(`   Markdown: ${mdPath}`);
      console.log(`\n📊 整體進度: ${report.progress.overall.toFixed(1)}%`);
      break;

    default:
      console.log("Factory 遷移進度追踪工具");
      console.log("");
      console.log("使用方式:");
      console.log(
        "  npm run migration:init                        # 初始化狀態文件",
      );
      console.log(
        "  npm run migration:update <module> <status> [progress]  # 更新模組狀態",
      );
      console.log(
        "  npm run migration:report                      # 生成進度報告",
      );
      console.log("");
      console.log("範例:");
      console.log("  npm run migration:update users in-progress 50");
      console.log("  npm run migration:update menu completed 100");
  }
}

// 執行
if (require.main === module) {
  cli();
}

module.exports = {
  initMigrationStatus,
  recordModuleMigration,
  generateProgressReport,
  generateMarkdownReport,
};
