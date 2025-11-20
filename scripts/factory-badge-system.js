#!/usr/bin/env node

/**
 * Factory 徽章系統
 *
 * 用途：
 * - 追蹤開發者的 factory 使用情況
 * - 授予成就徽章
 * - 遊戲化激勵團隊遷移
 * - 生成排行榜
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 徽章定義
const BADGES = {
  // 🥉 青銅級徽章
  firstStep: {
    id: 'first-step',
    name: '第一步',
    icon: '🌱',
    description: '首次在測試中使用 factory',
    level: 'bronze',
    requirement: { type: 'firstFactoryUse' }
  },

  resetMaster: {
    id: 'reset-master',
    name: '重置大師',
    icon: '🔄',
    description: '所有使用 factory 的測試都正確調用 resetAllFactories',
    level: 'bronze',
    requirement: { type: 'allHaveReset' }
  },

  // 🥈 銀級徽章
  earlyAdopter: {
    id: 'early-adopter',
    name: '早期採用者',
    icon: '🚀',
    description: '在試點階段就開始使用 factory',
    level: 'silver',
    requirement: { type: 'pilotParticipant' }
  },

  migrationPro: {
    id: 'migration-pro',
    name: '遷移專家',
    icon: '📦',
    description: '成功遷移 5 個以上的測試文件',
    level: 'silver',
    requirement: { type: 'fileCount', count: 5 }
  },

  testBuilder: {
    id: 'test-builder',
    name: '測試構建者',
    icon: '🏗️',
    description: '使用 buildCompleteRestaurantData 創建複雜測試場景',
    level: 'silver',
    requirement: { type: 'useCompleteData' }
  },

  // 🥇 金級徽章
  factoryChampion: {
    id: 'factory-champion',
    name: 'Factory 冠軍',
    icon: '👑',
    description: '成為 Factory Champion，幫助其他人使用 factory',
    level: 'gold',
    requirement: { type: 'isChampion' }
  },

  perfectionist: {
    id: 'perfectionist',
    name: '完美主義者',
    icon: '💎',
    description: '遷移 10 個以上的測試文件，且所有文件都完美無誤',
    level: 'gold',
    requirement: { type: 'fileCount', count: 10, perfect: true }
  },

  teamLeader: {
    id: 'team-leader',
    name: '團隊領袖',
    icon: '🎖️',
    description: '幫助至少 3 位團隊成員成功使用 factory',
    level: 'gold',
    requirement: { type: 'helpedOthers', count: 3 }
  },

  // 🏆 傳奇徽章
  factoryLegend: {
    id: 'factory-legend',
    name: 'Factory 傳奇',
    icon: '🏆',
    description: '獲得所有其他徽章',
    level: 'legendary',
    requirement: { type: 'allBadges' }
  }
}

// 徽章文件路徑
const BADGE_FILE = 'reports/factory-badges.json'

/**
 * 初始化徽章系統
 */
function initBadgeSystem() {
  if (fs.existsSync(BADGE_FILE)) {
    return JSON.parse(fs.readFileSync(BADGE_FILE, 'utf-8'))
  }

  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    developers: {}
  }
}

/**
 * 獲取 Git 作者信息
 */
function getGitAuthor(filePath) {
  try {
    const author = execSync(
      `git log -1 --format="%an" -- "${filePath}"`,
      { encoding: 'utf-8' }
    ).trim()
    return author || 'Unknown'
  } catch {
    return 'Unknown'
  }
}

/**
 * 分析開發者的 factory 使用情況
 */
function analyzeDeveloperUsage() {
  const glob = require('glob')
  const testFiles = glob.sync('apps/api/src/**/__tests__/**/*.test.ts')

  const developerStats = {}

  testFiles.forEach(file => {
    const author = getGitAuthor(file)
    const content = fs.readFileSync(file, 'utf-8')

    if (!developerStats[author]) {
      developerStats[author] = {
        name: author,
        filesWithFactory: 0,
        filesWithReset: 0,
        totalFiles: 0,
        usesCompleteData: false,
        factoryCallCount: 0
      }
    }

    const stats = developerStats[author]
    stats.totalFiles++

    const hasFactory = /@makanmakan\/testing-utils/.test(content)
    const hasReset = /resetAllFactories/.test(content)
    const hasCompleteData = /buildCompleteRestaurantData/.test(content)

    if (hasFactory) {
      stats.filesWithFactory++
    }

    if (hasReset) {
      stats.filesWithReset++
    }

    if (hasCompleteData) {
      stats.usesCompleteData = true
    }

    // 計算 factory 調用次數
    const factoryMatches = content.match(/Factory\.(build|buildList)/g) || []
    stats.factoryCallCount += factoryMatches.length
  })

  return developerStats
}

/**
 * 檢查是否獲得徽章
 */
function checkBadgeRequirement(requirement, stats, badges, allDevelopers) {
  switch (requirement.type) {
    case 'firstFactoryUse':
      return stats.filesWithFactory > 0

    case 'allHaveReset':
      return (
        stats.filesWithFactory > 0 &&
        stats.filesWithFactory === stats.filesWithReset
      )

    case 'pilotParticipant':
      // 檢查是否在試點期間（2025-11-15 到 2025-11-22）就開始使用
      return stats.filesWithFactory > 0 // 簡化實現

    case 'fileCount':
      const meetsCount = stats.filesWithFactory >= requirement.count
      if (requirement.perfect) {
        return meetsCount && stats.filesWithFactory === stats.filesWithReset
      }
      return meetsCount

    case 'useCompleteData':
      return stats.usesCompleteData

    case 'isChampion':
      // 需要手動授予
      return badges.includes('factory-champion')

    case 'helpedOthers':
      // 需要手動記錄
      return false

    case 'allBadges':
      const allBadgeIds = Object.keys(BADGES).filter(
        id => BADGES[id].level !== 'legendary'
      )
      return allBadgeIds.every(id => badges.includes(id))

    default:
      return false
  }
}

/**
 * 授予徽章
 */
function awardBadges(developerStats) {
  const badgeData = initBadgeSystem()

  Object.entries(developerStats).forEach(([author, stats]) => {
    if (!badgeData.developers[author]) {
      badgeData.developers[author] = {
        name: author,
        badges: [],
        stats: {}
      }
    }

    const dev = badgeData.developers[author]
    dev.stats = stats

    // 檢查每個徽章
    Object.entries(BADGES).forEach(([key, badge]) => {
      const alreadyHas = dev.badges.includes(badge.id)

      if (
        !alreadyHas &&
        checkBadgeRequirement(
          badge.requirement,
          stats,
          dev.badges,
          badgeData.developers
        )
      ) {
        dev.badges.push(badge.id)
        console.log(`🎉 ${author} 獲得新徽章: ${badge.icon} ${badge.name}`)
      }
    })
  })

  badgeData.lastUpdated = new Date().toISOString()

  // 保存
  const dir = path.dirname(BADGE_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(BADGE_FILE, JSON.stringify(badgeData, null, 2))

  return badgeData
}

/**
 * 生成排行榜
 */
function generateLeaderboard(badgeData) {
  const developers = Object.values(badgeData.developers)

  // 計算分數
  const levelScores = {
    bronze: 10,
    silver: 25,
    gold: 50,
    legendary: 100
  }

  developers.forEach(dev => {
    dev.score = dev.badges.reduce((total, badgeId) => {
      const badge = Object.values(BADGES).find(b => b.id === badgeId)
      return total + (badge ? levelScores[badge.level] : 0)
    }, 0)
  })

  // 排序
  developers.sort((a, b) => b.score - a.score)

  return developers
}

/**
 * 生成 Markdown 報告
 */
function generateMarkdownReport(badgeData) {
  const leaderboard = generateLeaderboard(badgeData)

  const lines = [
    '# 🏆 Factory 徽章系統排行榜',
    '',
    `> 📊 最後更新: ${new Date(badgeData.lastUpdated).toLocaleString('zh-TW')}`,
    '',
    '---',
    '',
    '## 🥇 排行榜',
    '',
    '| 排名 | 開發者 | 分數 | 徽章 | 文件數 |',
    '|------|--------|------|------|--------|'
  ]

  leaderboard.forEach((dev, index) => {
    const badgeIcons = dev.badges
      .map(badgeId => {
        const badge = Object.values(BADGES).find(b => b.id === badgeId)
        return badge ? badge.icon : ''
      })
      .join(' ')

    lines.push(
      `| ${index + 1} | ${dev.name} | ${dev.score} | ${badgeIcons || '-'} | ${dev.stats.filesWithFactory} |`
    )
  })

  lines.push(
    '',
    '---',
    '',
    '## 🎖️ 徽章說明',
    '',
    '### 🥉 青銅級徽章',
    ''
  )

  Object.values(BADGES)
    .filter(b => b.level === 'bronze')
    .forEach(badge => {
      lines.push(`- ${badge.icon} **${badge.name}**: ${badge.description}`)
    })

  lines.push('', '### 🥈 銀級徽章', '')

  Object.values(BADGES)
    .filter(b => b.level === 'silver')
    .forEach(badge => {
      lines.push(`- ${badge.icon} **${badge.name}**: ${badge.description}`)
    })

  lines.push('', '### 🥇 金級徽章', '')

  Object.values(BADGES)
    .filter(b => b.level === 'gold')
    .forEach(badge => {
      lines.push(`- ${badge.icon} **${badge.name}**: ${badge.description}`)
    })

  lines.push('', '### 🏆 傳奇徽章', '')

  Object.values(BADGES)
    .filter(b => b.level === 'legendary')
    .forEach(badge => {
      lines.push(`- ${badge.icon} **${badge.name}**: ${badge.description}`)
    })

  lines.push(
    '',
    '---',
    '',
    '## 💪 如何獲得更多徽章',
    '',
    '1. 使用 factory 遷移更多測試文件',
    '2. 確保所有測試都正確調用 `resetAllFactories()`',
    '3. 嘗試使用 `buildCompleteRestaurantData()` 創建複雜場景',
    '4. 成為 Factory Champion，幫助其他團隊成員',
    '5. 參考文檔持續改進測試質量',
    '',
    '---',
    '',
    '**徽章系統**: `scripts/factory-badge-system.js`'
  )

  return lines.join('\n')
}

/**
 * 主函數
 */
function main() {
  console.log('🏆 Factory 徽章系統\n')

  console.log('📊 分析開發者使用情況...')
  const developerStats = analyzeDeveloperUsage()

  console.log('🎖️  授予徽章...\n')
  const badgeData = awardBadges(developerStats)

  console.log('\n📝 生成排行榜...')
  const markdown = generateMarkdownReport(badgeData)

  const reportPath = 'reports/factory-badges.md'
  fs.writeFileSync(reportPath, markdown)

  console.log(`✅ 徽章報告已生成: ${reportPath}\n`)

  // 顯示前 5 名
  const leaderboard = generateLeaderboard(badgeData)
  console.log('🥇 前 5 名:')
  leaderboard.slice(0, 5).forEach((dev, index) => {
    const badgeIcons = dev.badges
      .map(badgeId => {
        const badge = Object.values(BADGES).find(b => b.id === badgeId)
        return badge ? badge.icon : ''
      })
      .join(' ')

    console.log(
      `   ${index + 1}. ${dev.name} - ${dev.score} 分 ${badgeIcons}`
    )
  })
}

// 執行
if (require.main === module) {
  main()
}

module.exports = { BADGES, awardBadges, generateLeaderboard }
