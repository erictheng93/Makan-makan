/**
 * Cache Feature Module
 * Main export for the cache functionality feature
 */

import cacheRoutes from './routes'

export { createCacheService, CACHE_STRATEGIES, CacheKeys } from './services/CacheService'
export type * from './types'
export * from './schemas/validation'

export default cacheRoutes