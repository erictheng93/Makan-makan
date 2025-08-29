export interface Env {
  // Durable Object bindings
  REALTIME_SESSION: DurableObjectNamespace

  // Database bindings
  DB: D1Database
  
  // KV store binding
  CACHE: KVNamespace

  // Environment variables
  JWT_SECRET: string
  ENVIRONMENT: string
  API_VERSION: string
  
  // Rate limiting
  RATE_LIMIT_ENABLED: string
  
  // Logging
  SLACK_WEBHOOK_URL?: string
}