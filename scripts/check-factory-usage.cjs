#!/usr/bin/env node

/**
 * Factory 使用檢查工具
 *
 * 用途：
 * - 自動檢查測試文件是否正確使用 factory
 * - 可在 CI/CD 中運行
 * - 生成詳細報告
 * - 可選擇是否阻塞構建
 */

const fs = require('fs')
const path = require('path')
const glob = require('glob')

// 配置
const CONFIG = {
  scanDirs: [
    'apps/api/src/**/__tests__/**/*.test.ts',
    'apps/admin-dashboard/src/**/*.test.ts',
    'apps/customer-app/src/**/*.test.ts',
    'apps/kitchen-display/src/**/*.test.ts',
    'packages/*/src/**/*.test.ts'
  ],

  // 檢查規則
  rules: {
    // 錯誤級別：必須修復
    errors: [
      {
        name: 'missing-reset',
        message: '使用 factory 但缺少 resetAllFactories()',
        check: (content, stats) => {
          return stats.hasFactoryUsage && !stats.hasResetCall
        }
      },
      {
        name: 'missing-factory-import',
        message: '使用 factory 方法但沒有導入',
        check: (content, stats) => {
          return stats.hasFactoryUsage && !stats.hasFactoryImport
        }
      }
    ],

    // 警告級別：建議修復
    warnings: [
      {
        name: 'manual-data-creation',
        message: '手動創建測試數據，建議使用 factory',
        check: (content, stats) => {
          // 檢測常見的手動數據創建模式
          const manualPatterns = [
            /const \w+ = \{[\s\S]*?id:\s*\d+[\s\S]*?}/g, // 包含 id 的對象字面量
            /const \w+ = \{[\s\S]*?role:\s*['"`]/g, // 包含 role 的對象字面量
            /const \w+ = \{[\s\S]*?username:\s*['"`]/g, // 包含 username 的對象字面量
            /const \w+ = \{[\s\S]*?restaurantId:\s*\d+[\s\S]*?}/g // 包含 restaurantId 的對象字面量
          ]

          return (
            !stats.hasFactoryUsage &&
            manualPatterns.some(pattern => pattern.test(content))
          )
        }
      },
      {
        name: 'large-test-file',
        message: '測試文件過大，考慮拆分或使用 factory 簡化',
        check: (content, stats) => {
          return stats.lineCount > 500 && !stats.hasFactoryUsage
        }
      }
    ]
  },

  // 輸出選項
  output: {
    format: process.env.OUTPUT_FORMAT || 'console', // console | json | github
    failOnError: process.env.FAIL_ON_ERROR === 'true',
    failOnWarning: process.env.FAIL_ON_WARNING === 'true'
  }
}

/**
 * 分析單個文件
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const relativePath = path.relative(process.cwd(), filePath)

  const stats = {
    file: relativePath,
    lineCount: content.split('\n').length,
    hasFactoryImport: /@makanmakan\/testing-utils/.test(content),
    hasFactoryUsage:
      /userFactory|restaurantFactory|menuItemFactory|orderFactory|buildCompleteRestaurantData/.test(
        content
      ),
    hasResetCall: /resetAllFactories\s*\(\s*\)/.test(content)
  }

  const issues = {
    errors: [],
    warnings: []
  }

  // 檢查錯誤
  CONFIG.rules.errors.forEach(rule => {
    if (rule.check(content, stats)) {
      issues.errors.push({
        rule: rule.name,
        message: rule.message,
        file: relativePath
      })
    }
  })

  // 檢查警告
  CONFIG.rules.warnings.forEach(rule => {
    if (rule.check(content, stats)) {
      issues.warnings.push({
        rule: rule.name,
        message: rule.message,
        file: relativePath
      })
    }
  })

  return { stats, issues }
}

/**
 * 掃描所有測試文件
 */
function scanAllFiles() {
  console.log('🔍 開始掃描測試文件...\n')

  const allFiles = []
  CONFIG.scanDirs.forEach(pattern => {
    const matches = glob.sync(pattern, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    })
    allFiles.push(...matches)
  })

  console.log(`📁 找到 ${allFiles.length} 個測試文件\n`)

  const results = allFiles.map(analyzeFile)

  return {
    totalFiles: allFiles.length,
    results
  }
}

/**
 * 生成報告
 */
function generateReport(scanResults) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: scanResults.totalFiles,
      filesWithErrors: 0,
      filesWithWarnings: 0,
      totalErrors: 0,
      totalWarnings: 0
    },
    details: {
      errors: [],
      warnings: []
    }
  }

  // 統計問題
  scanResults.results.forEach(result => {
    if (result.issues.errors.length > 0) {
      report.summary.filesWithErrors++
      report.summary.totalErrors += result.issues.errors.length
      report.details.errors.push(...result.issues.errors)
    }

    if (result.issues.warnings.length > 0) {
      report.summary.filesWithWarnings++
      report.summary.totalWarnings += result.issues.warnings.length
      report.details.warnings.push(...result.issues.warnings)
    }
  })

  return report
}

/**
 * 輸出報告（控制台格式）
 */
function outputConsoleReport(report) {
  console.log('📊 Factory 使用檢查報告')
  console.log('═══════════════════════════════════════\n')

  console.log('📈 摘要')
  console.log(`   總文件數: ${report.summary.totalFiles}`)
  console.log(`   ❌ 錯誤: ${report.summary.totalErrors} (${report.summary.filesWithErrors} 個文件)`)
  console.log(`   ⚠️  警告: ${report.summary.totalWarnings} (${report.summary.filesWithWarnings} 個文件)\n`)

  if (report.details.errors.length > 0) {
    console.log('❌ 錯誤詳情')
    console.log('───────────────────────────────────────')
    report.details.errors.forEach((error, index) => {
      console.log(`\n${index + 1}. ${error.file}`)
      console.log(`   規則: ${error.rule}`)
      console.log(`   訊息: ${error.message}`)
    })
    console.log()
  }

  if (report.details.warnings.length > 0 && report.details.warnings.length <= 10) {
    console.log('⚠️  警告詳情（前 10 項）')
    console.log('───────────────────────────────────────')
    report.details.warnings.slice(0, 10).forEach((warning, index) => {
      console.log(`\n${index + 1}. ${warning.file}`)
      console.log(`   規則: ${warning.rule}`)
      console.log(`   訊息: ${warning.message}`)
    })
    console.log()
  }

  // 建議
  console.log('💡 建議')
  console.log('───────────────────────────────────────')

  if (report.summary.totalErrors > 0) {
    console.log('❌ 發現 ' + report.summary.totalErrors + ' 個錯誤，必須修復：')
    console.log('   1. 為使用 factory 的測試添加 resetAllFactories()')
    console.log('   2. 確保正確導入 @makanmakan/testing-utils\n')
  }

  if (report.summary.totalWarnings > 0) {
    console.log('⚠️  發現 ' + report.summary.totalWarnings + ' 個警告，建議處理：')
    console.log('   1. 考慮使用 factory 替代手動數據創建')
    console.log('   2. 拆分過大的測試文件')
    console.log('   3. 參考文檔：docs/testing/FACTORY_QUICK_REFERENCE.md\n')
  }

  if (report.summary.totalErrors === 0 && report.summary.totalWarnings === 0) {
    console.log('✅ 所有測試文件都正確使用 factory！\n')
  }
}

/**
 * 輸出報告（GitHub Actions 格式）
 */
function outputGitHubReport(report) {
  // GitHub Actions annotations
  report.details.errors.forEach(error => {
    console.log(
      `::error file=${error.file}::${error.message} (${error.rule})`
    )
  })

  report.details.warnings.forEach(warning => {
    console.log(
      `::warning file=${warning.file}::${warning.message} (${warning.rule})`
    )
  })

  // Summary
  console.log('\n## Factory 使用檢查報告\n')
  console.log(`- 總文件數: ${report.summary.totalFiles}`)
  console.log(`- ❌ 錯誤: ${report.summary.totalErrors}`)
  console.log(`- ⚠️ 警告: ${report.summary.totalWarnings}`)
}

/**
 * 輸出報告（JSON 格式）
 */
function outputJsonReport(report) {
  console.log(JSON.stringify(report, null, 2))
}

/**
 * 主函數
 */
function main() {
  try {
    // 掃描文件
    const scanResults = scanAllFiles()

    // 生成報告
    const report = generateReport(scanResults)

    // 輸出報告
    switch (CONFIG.output.format) {
      case 'json':
        outputJsonReport(report)
        break
      case 'github':
        outputGitHubReport(report)
        break
      default:
        outputConsoleReport(report)
    }

    // 決定退出碼
    let exitCode = 0

    if (CONFIG.output.failOnError && report.summary.totalErrors > 0) {
      console.log('\n❌ 由於存在錯誤，檢查失敗')
      exitCode = 1
    }

    if (CONFIG.output.failOnWarning && report.summary.totalWarnings > 0) {
      console.log('\n⚠️  由於存在警告，檢查失敗')
      exitCode = 1
    }

    if (exitCode === 0 && (report.summary.totalErrors > 0 || report.summary.totalWarnings > 0)) {
      console.log('\n💡 提示：這次檢查不會阻塞構建，但建議盡快修復問題')
    }

    process.exit(exitCode)
  } catch (error) {
    console.error('❌ 檢查過程發生錯誤:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// 執行
if (require.main === module) {
  main()
}

module.exports = { analyzeFile, generateReport }
