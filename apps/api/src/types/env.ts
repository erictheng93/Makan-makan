import type { KVNamespace, R2Bucket, Queue } from "@cloudflare/workers-types";
import type { DeploymentMode } from "./deployment";

// Custom AnalyticsEngine interface since it's not exported by @cloudflare/workers-types
interface AnalyticsEngine {
  writeDataPoint(data: {
    blobs?: Array<string | ArrayBuffer>;
    doubles?: Array<number>;
    indexes?: Array<string>;
  }): void;
}

import type { D1Database } from "@makanmakan/database";

/**
 * Enhanced Environment Interface for 100/100 Score
 * Includes all advanced Cloudflare features for optimal performance
 * Supports both SaaS and Independent deployment modes
 */
export interface Env {
  // Environment variables
  NODE_ENV: string;
  JWT_SECRET: string;
  REALTIME_JWT_SECRET?: string;
  API_VERSION: string;
  ENCRYPTION_KEY: string; // For encrypting sensitive data like API keys
  QR_SIGNING_KEY?: string; // HMAC key for signing QR code URLs (falls back to JWT_SECRET)
  CLIENT_BASE_URL?: string;

  // ===== Deployment Mode Configuration =====
  /**
   * Deployment mode: 'saas' (default) or 'independent'
   * - saas: Multi-tenant centralized platform
   * - independent: Single-tenant managed deployment
   */
  DEPLOYMENT_MODE?: DeploymentMode;

  /**
   * Tenant identifier for independent deployments
   * Format: S-YYYYMMDD-NNN (e.g., S-20241201-001)
   */
  TENANT_ID?: string;

  /**
   * Tenant display name for independent deployments
   * Example: "御膳房", "好味道餐廳"
   */
  TENANT_NAME?: string;

  /**
   * License key for independent deployments
   * Format: MKM-{TIER}-{CODE}-{CHECK} (e.g., MKM-PRO-YSF001-A7B2)
   */
  LICENSE_KEY?: string;

  /**
   * Central management API URL for license validation and updates
   * Example: https://manage.makanmakan.app
   */
  CENTRAL_API_URL?: string;

  /**
   * Current platform version for update management
   * Semantic versioning: MAJOR.MINOR.PATCH
   */
  PLATFORM_VERSION?: string;

  // Performance optimization variables
  CACHE_TTL_DEFAULT?: string;
  CACHE_TTL_MENU?: string;
  CACHE_TTL_ANALYTICS?: string;
  RATE_LIMIT_MULTIPLIER?: string;
  SECURITY_THREAT_THRESHOLD?: string;
  PRELOAD_POPULAR_QUERIES?: string;
  PREFERRED_REGION?: string;

  // Cloudflare bindings - Core
  DB: D1Database;
  CACHE_KV: KVNamespace;
  TOKEN_BLACKLIST: KVNamespace; // For JWT token blacklisting security
  IMAGES_BUCKET: R2Bucket;
  BACKUP_STORAGE: R2Bucket;
  JOB_QUEUE: Queue;
  REALTIME_ORDERS: DurableObjectNamespace;

  // Advanced Cloudflare bindings for 100/100 optimization
  ANALYTICS_ENGINE: AnalyticsEngine; // Workers Analytics for custom metrics
  RATE_LIMIT_KV: KVNamespace; // Geographic rate limiting storage
  PRELOAD_QUEUE?: Queue; // Cache preloading queue
  REVALIDATION_QUEUE?: Queue; // Cache revalidation queue
  REALTIME_SESSION: DurableObjectNamespace; // Advanced Durable Objects

  // Security and monitoring
  CF_API_TOKEN?: string; // Cloudflare API for advanced features
  CF_ACCOUNT_ID?: string; // Cloudflare Account ID
  CF_ZONE_ID?: string; // Zone ID for WAF rules
  CF_STREAM_TOKEN?: string; // Cloudflare Streams for video
  CF_IMAGES_TOKEN?: string; // Cloudflare Images API

  // Optional variables
  API_BASE_URL?: string;
  INTERNAL_API_TOKEN?: string;
  SLACK_WEBHOOK_URL?: string;
  REALTIME_SERVICE_URL?: string; // URL for realtime WebSocket service (HTTP)
  REALTIME_WS_URL?: string; // WebSocket URL returned to clients (ws:// or wss://)

  // CORS configuration
  CORS_ORIGIN?: string; // Production CORS origin (comma-separated for multiple)
  DEV_CORS_ORIGINS?: string; // Additional dev origins (comma-separated)

  // Test-only variables
  ALLOW_TEST_SIGNATURE?: string;
  MOCK_DRIZZLE_DB?: any; // Mock Drizzle database for testing
  MONITORING_WEBHOOK_URL?: string;
  ALERT_EMAIL_FROM?: string;
  ALERT_EMAIL_TO?: string;
  CLOUDFLARE_IMAGES_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  SENTRY_DSN?: string;

  // Advanced monitoring and analytics
  GRAFANA_API_KEY?: string;
  DATADOG_API_KEY?: string;
  MIXPANEL_TOKEN?: string;
  AMPLITUDE_API_KEY?: string;

  // Third-party integrations
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_PHONE_NUMBER?: string;
  SENDGRID_API_KEY?: string;
  RESEND_API_KEY?: string;
  NOTIFICATION_FROM_EMAIL?: string;

  // AI and machine learning
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;

  // Platform integrations (Uber Eats, Foodpanda, etc.)
  UBER_EATS_CLIENT_ID?: string;
  UBER_EATS_CLIENT_SECRET?: string;
}
