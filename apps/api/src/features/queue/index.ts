/**
 * Queue Feature Module
 * Unified queue management system integrating legacy and modular approaches
 */

import { queueRoutes } from './routes'

export const queueFeature = {
  routes: queueRoutes,
  version: '2.0.0',
  name: 'queue',
  description: 'Unified queue management system'
}

export default queueFeature

console.log('[queue] INFO: queue module initialized', {
  version: queueFeature.version,
  description: queueFeature.description
})