/**
 * Default configuration for Print Agent
 */

import { LocalPrintServiceConfig } from '../LocalPrintService'

export function createDefaultConfig(): LocalPrintServiceConfig {
  const restaurantId = parseInt(process.env.RESTAURANT_ID || '1')
  const port = parseInt(process.env.PRINT_AGENT_PORT || '3003')
  const wsPort = parseInt(process.env.PRINT_AGENT_WS_PORT || '3004')

  return {
    // Network settings
    port,
    wsPort,
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()),

    // Authentication settings
    apiKey: process.env.PRINT_AGENT_API_KEY || generateDefaultApiKey(restaurantId),
    cloudEndpoint: process.env.CLOUD_API_ENDPOINT || 'http://localhost:8787/api/v1',

    // Service settings
    serviceName: `Print Agent - Restaurant ${restaurantId}`,
    restaurantId,

    // Printer settings
    autoDiscovery: process.env.AUTO_DISCOVERY !== 'false',
    discoveryInterval: parseInt(process.env.DISCOVERY_INTERVAL || '30000'), // 30 seconds
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '60000'), // 1 minute

    // Queue settings
    maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE || '100'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.RETRY_DELAY || '5000') // 5 seconds
  }
}

function generateDefaultApiKey(restaurantId: number): string {
  // Generate a basic API key for development
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `print_${restaurantId}_${timestamp}_${random}`
}

export const defaultPrinterSettings = {
  // Default printer brands to support
  supportedBrands: ['epson', 'citizen', 'star'],

  // Default connection types
  connectionTypes: ['usb', 'network'],

  // Default print settings
  printSettings: {
    paperWidth: 80, // mm
    fontSize: 12,
    encoding: 'utf8',
    timeout: 10000 // ms
  },

  // Default receipt templates
  templates: {
    receipt: {
      header: true,
      footer: true,
      qrCode: true,
      logo: false
    },
    kitchen: {
      header: false,
      footer: false,
      qrCode: false,
      logo: false
    }
  }
}