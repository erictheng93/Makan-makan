export interface Env {
  NODE_ENV: string
  JWT_SECRET: string
  DB: any
  CACHE_KV: any
  REALTIME_ORDERS: any
  [key: string]: any
}

export interface RealtimeMessage {
  type: string
  data: any
  timestamp: number
  id: string
}

export interface ConnectionState {
  sessionId: string
  restaurantId: string
  userId?: string
  connectedAt: number
  lastActivity: number
}