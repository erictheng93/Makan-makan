import type { KVNamespace, R2Bucket, Queue } from '@cloudflare/workers-types'
import type { D1Database } from '@makanmakan/database'

export interface Env {
  // Environment variables
  NODE_ENV: string
  JWT_SECRET: string
  API_VERSION: string
  
  // Cloudflare bindings
  DB: D1Database
  CACHE_KV: KVNamespace
  TOKEN_BLACKLIST: KVNamespace // For JWT token blacklisting security
  IMAGES_BUCKET: R2Bucket
  JOB_QUEUE: Queue
  REALTIME_ORDERS: DurableObjectNamespace
  
  // Optional variables
  SLACK_WEBHOOK_URL?: string
  CLOUDFLARE_IMAGES_KEY?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  SENTRY_DSN?: string
}