/**
 * 列印服務預設配置
 */

import type { PrintServiceConfig } from "@makanmakan/shared-types";

export const DEFAULT_PRINT_CONFIG: PrintServiceConfig = {
  // 預設設備
  defaultDevice: null,

  // 佇列配置
  queue: {
    maxConcurrentJobs: 3,
    maxRetries: 3,
    retryDelay: 5000, // 5秒
    jobTimeout: 30000, // 30秒
    maxQueueSize: 100,
  },

  // 驅動配置
  drivers: {
    connectionTimeout: 10000, // 10秒
    commandTimeout: 5000, // 5秒
    heartbeatInterval: 30000, // 30秒
    retryAttempts: 3,
  },

  // 地區配置
  regions: {
    default: "TW",
    supported: ["TW", "MY", "VN"],
  },

  // 監控配置
  monitoring: {
    healthCheckInterval: 60000, // 1分鐘
    statisticsInterval: 300000, // 5分鐘
    maxErrorHistory: 100,
    alertThresholds: {
      errorRate: 0.1, // 10%
      queueDepth: 50,
      responseTime: 10000, // 10秒
    },
  },

  // 清理配置
  cleanup: {
    completedJobRetention: 24, // 24小時
    cleanupInterval: 3600000, // 1小時
  },
};

export const PRINTER_TIMEOUTS = {
  CONNECT: 10000,
  PRINT: 30000,
  STATUS: 5000,
  DRAWER: 3000,
  CUT: 5000,
};

export const RETRY_POLICIES = {
  CONNECTION: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  PRINT: {
    maxAttempts: 3,
    baseDelay: 2000,
    maxDelay: 15000,
    backoffMultiplier: 1.5,
  },
};

export const QUEUE_PRIORITIES = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
} as const;

export const DEVICE_STATUS = {
  ONLINE: "online",
  OFFLINE: "offline",
  ERROR: "error",
  BUSY: "busy",
  PAPER_OUT: "paper_out",
  COVER_OPEN: "cover_open",
} as const;
