#!/usr/bin/env node

/**
 * Route Migration Script
 * Helps migrate existing routes to feature modules
 *
 * Usage: node scripts/migration/migrate-routes.js --source=routes/orders.ts --target=features/orders/
 */

const fs = require('fs')
const path = require('path')

// Parse command line arguments
const args = process.argv.slice(2)
const options = {}

args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.substring(2).split('=')
    options[key] = value
  }
})

// Validate required options
if (!options.source || !options.target) {
  console.error('❌ Error: --source and --target are required')
  console.log('Usage: node scripts/migration/migrate-routes.js --source=routes/orders.ts --target=features/orders/')
  process.exit(1)
}

const sourcePath = path.join(__dirname, '../../apps/api/src', options.source)
const targetDir = path.join(__dirname, '../../apps/api/src', options.target)

console.log(`🔄 Migrating routes from ${options.source} to ${options.target}`)

// Check if source file exists
if (!fs.existsSync(sourcePath)) {
  console.error(`❌ Error: Source file not found: ${sourcePath}`)
  process.exit(1)
}

// Read source file
const sourceContent = fs.readFileSync(sourcePath, 'utf8')

// Extract route definitions using regex patterns
const routePatterns = {
  GET: /app\.get\(['"`]([^'"`]+)['"`][^{]+\{[\s\S]*?\}\)/g,
  POST: /app\.post\(['"`]([^'"`]+)['"`][^{]+\{[\s\S]*?\}\)/g,
  PUT: /app\.put\(['"`]([^'"`]+)['"`][^{]+\{[\s\S]*?\}\)/g,
  DELETE: /app\.delete\(['"`]([^'"`]+)['"`][^{]+\{[\s\S]*?\}\)/g,
  PATCH: /app\.patch\(['"`]([^'"`]+)['"`][^{]+\{[\s\S]*?\}\)/g
}

// Extract imports and dependencies
const imports = []
const importMatches = sourceContent.match(/^import\s+.*$/gm)
if (importMatches) {
  imports.push(...importMatches)
}

// Analyze the source file structure
console.log('📊 Analyzing source file...')
console.log(`📄 File size: ${sourceContent.length} characters`)
console.log(`📦 Imports found: ${imports.length}`)

// Count routes by method
const routeCounts = {}
Object.keys(routePatterns).forEach(method => {
  const matches = sourceContent.match(routePatterns[method])
  routeCounts[method] = matches ? matches.length : 0
})

console.log('🔍 Routes found:')
Object.entries(routeCounts).forEach(([method, count]) => {
  if (count > 0) {
    console.log(`  ${method}: ${count} routes`)
  }
})

// Extract validation schemas
const schemaMatches = sourceContent.match(/const\s+\w+Schema\s*=[\s\S]*?(?=const|\n\n|$)/g)
console.log(`📋 Validation schemas found: ${schemaMatches ? schemaMatches.length : 0}`)

// Extract helper functions
const helperFunctionMatches = sourceContent.match(/^(async\s+)?function\s+\w+[\s\S]*?\n\}/gm)
console.log(`⚙️ Helper functions found: ${helperFunctionMatches ? helperFunctionMatches.length : 0}`)

// Create target directory structure if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
  fs.mkdirSync(path.join(targetDir, 'routes'))
  fs.mkdirSync(path.join(targetDir, 'services'))
  fs.mkdirSync(path.join(targetDir, 'schemas'))
  fs.mkdirSync(path.join(targetDir, 'types'))
  console.log(`📁 Created target directory structure: ${targetDir}`)
}

// Generate migration plan
const migrationPlan = {
  sourceFile: options.source,
  targetDirectory: options.target,
  routes: routeCounts,
  imports: imports.length,
  schemas: schemaMatches ? schemaMatches.length : 0,
  helpers: helperFunctionMatches ? helperFunctionMatches.length : 0,
  estimatedFiles: {
    'routes/index.ts': 'Main route definitions',
    'services/Service.ts': 'Business logic extraction',
    'schemas/validation.ts': 'Validation schemas',
    'types/index.ts': 'Type definitions'
  }
}

// Save migration plan
const planPath = path.join(targetDir, 'migration-plan.json')
fs.writeFileSync(planPath, JSON.stringify(migrationPlan, null, 2))
console.log(`📋 Migration plan saved to: ${planPath}`)

// Create a backup of the original file
const backupPath = sourcePath + '.backup'
fs.copyFileSync(sourcePath, backupPath)
console.log(`💾 Backup created: ${backupPath}`)

// Generate suggested file splits
console.log('\n📝 Suggested migration strategy:')
console.log('1. Extract validation schemas to schemas/validation.ts')
console.log('2. Move business logic to services/')
console.log('3. Split routes by functionality:')

// Analyze route patterns to suggest splits
const routeAnalysis = []
Object.keys(routePatterns).forEach(method => {
  const matches = sourceContent.match(routePatterns[method])
  if (matches) {
    matches.forEach(match => {
      const pathMatch = match.match(/['"`]([^'"`]+)['"`]/)
      if (pathMatch) {
        routeAnalysis.push({
          method,
          path: pathMatch[1],
          content: match.substring(0, 100) + '...'
        })
      }
    })
  }
})

// Group routes by pattern
const routeGroups = {}
routeAnalysis.forEach(route => {
  const pathParts = route.path.split('/')
  const basePattern = pathParts.length > 1 ? pathParts[1] : 'root'

  if (!routeGroups[basePattern]) {
    routeGroups[basePattern] = []
  }

  routeGroups[basePattern].push(route)
})

Object.entries(routeGroups).forEach(([pattern, routes]) => {
  console.log(`   - ${pattern}.ts (${routes.length} routes)`)
  routes.forEach(route => {
    console.log(`     * ${route.method} ${route.path}`)
  })
})

console.log('\n🚀 Ready to migrate!')
console.log('Next steps:')
console.log('1. Review the migration plan')
console.log('2. Create feature module if not exists')
console.log('3. Manually extract and refactor code sections')
console.log('4. Update imports and dependencies')
console.log('5. Test the migrated functionality')
console.log('6. Update main router to use new feature module')

// Offer to generate stub files
console.log('\n❓ Would you like to generate stub files? (Run with --generate-stubs)')
if (process.argv.includes('--generate-stubs')) {
  console.log('📄 Generating stub files...')

  // Generate basic route stub
  const routeStub = `/**
 * ${options.target.replace('features/', '').replace('/', '')} Routes
 * Migrated from ${options.source}
 */

import { Hono } from 'hono'
import type { Env } from '../../../shared/types'

const app = new Hono<{ Bindings: Env }>()

// TODO: Migrate routes from ${options.source}
${routeAnalysis.map(route => `
// ${route.method} ${route.path}
// app.${route.method.toLowerCase()}('${route.path}', async (c) => {
//   // TODO: Implement route logic
// })`).join('\n')}

export default app`

  fs.writeFileSync(path.join(targetDir, 'routes', 'index.ts'), routeStub)
  console.log('✅ Generated routes/index.ts stub')
}