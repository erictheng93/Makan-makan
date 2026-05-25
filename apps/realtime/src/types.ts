export interface Env {
  ENVIRONMENT?: string;
  REALTIME_SESSION: DurableObjectNamespace;
  ANALYTICS_ENGINE?: AnalyticsEngineDataset;
  DB: D1Database;
  JWT_SECRET: string;
  TOKEN_BLACKLIST?: KVNamespace;
  RATE_LIMIT_KV?: KVNamespace;
  RATE_LIMIT_ENABLED?: string;
}

export interface RealtimeMessage {
  type: string;
  data: unknown;
  timestamp: number;
  id: string;
}

export interface ConnectionState {
  sessionId: string;
  restaurantId: string;
  userId?: string;
  connectedAt: number;
  lastActivity: number;
}
