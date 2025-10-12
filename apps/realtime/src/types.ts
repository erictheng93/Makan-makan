export interface Env {
  ENVIRONMENT?: string
  REALTIME_SESSION: DurableObjectNamespace
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