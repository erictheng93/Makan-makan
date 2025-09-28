/**
 * SSE (Server-Sent Events) Feature Module
 * Real-time event broadcasting and connection management
 */

import { sseRoutes } from './routes'

export const sseFeature = {
  routes: sseRoutes,
  version: '1.0.0',
  name: 'sse'
}

export default sseFeature

console.log('[sse] INFO: sse module initialized', {
  version: sseFeature.version
})