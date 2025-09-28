/**
 * Legacy Monitoring Routes Redirect
 * This file redirects to the new modular monitoring feature
 * @deprecated Use features/monitoring module instead
 */

import { Hono } from 'hono'
import monitoringFeature from '../features/monitoring'
import type { Env } from '../types/env'

const app = new Hono<{ Bindings: Env }>()

// Redirect all monitoring routes to the new feature module
app.route('/', monitoringFeature.routes)

// Add deprecation warning middleware
app.use('*', async (c, next) => {
  console.warn('[DEPRECATED] /routes/monitoring.ts is deprecated. Use /features/monitoring instead.')
  await next()
})

export default app