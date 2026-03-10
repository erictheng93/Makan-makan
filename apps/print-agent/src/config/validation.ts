/**
 * Configuration validation for Print Agent
 */

import { z } from "zod";
import { LocalPrintServiceConfig } from "../LocalPrintService";

const configSchema = z.object({
  // Network settings
  port: z.number().min(1).max(65535),
  wsPort: z.number().min(1).max(65535),
  allowedOrigins: z.array(z.string()),

  // Authentication settings
  apiKey: z.string().min(10),
  cloudEndpoint: z.string().url(),

  // Service settings
  serviceName: z.string().min(1),
  restaurantId: z.string().min(1),

  // Printer settings
  autoDiscovery: z.boolean(),
  discoveryInterval: z.number().min(1000), // At least 1 second
  heartbeatInterval: z.number().min(1000), // At least 1 second

  // Queue settings
  maxQueueSize: z.number().min(1).max(1000),
  maxRetries: z.number().min(0).max(10),
  retryDelay: z.number().min(100), // At least 100ms
});

export interface ConfigValidationResult {
  success: boolean;
  errors: string[];
  config?: LocalPrintServiceConfig;
}

export function validateConfig(
  config: LocalPrintServiceConfig,
): ConfigValidationResult {
  try {
    const validated = configSchema.parse(config);

    // Additional validation rules
    const errors: string[] = [];

    // Check port conflicts
    if (config.port === config.wsPort) {
      errors.push("HTTP port and WebSocket port cannot be the same");
    }

    // Check environment-specific settings
    if (process.env.NODE_ENV === "production") {
      if (config.apiKey.includes("default") || config.apiKey.length < 32) {
        errors.push(
          "Production environment requires a secure API key (min 32 characters)",
        );
      }

      if (config.allowedOrigins.includes("*")) {
        errors.push("Production environment should not allow all origins (*)");
      }
    }

    // Check network connectivity requirements
    if (config.autoDiscovery && config.discoveryInterval < 10000) {
      errors.push(
        "Auto discovery interval should be at least 10 seconds to avoid network spam",
      );
    }

    if (errors.length > 0) {
      return {
        success: false,
        errors,
      };
    }

    return {
      success: true,
      errors: [],
      config: validated,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      };
    }

    return {
      success: false,
      errors: [`Configuration validation failed: ${error}`],
    };
  }
}

export function validateEnvironment(): { success: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required environment variables
  const required = ["RESTAURANT_ID"];

  for (const envVar of required) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Validate RESTAURANT_ID format
  if (process.env.RESTAURANT_ID) {
    if (process.env.RESTAURANT_ID.trim().length === 0) {
      errors.push("RESTAURANT_ID must be a non-empty string");
    }
  }

  // Validate port numbers if provided
  if (process.env.PRINT_AGENT_PORT) {
    const port = parseInt(process.env.PRINT_AGENT_PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push("PRINT_AGENT_PORT must be a valid port number (1-65535)");
    }
  }

  if (process.env.PRINT_AGENT_WS_PORT) {
    const wsPort = parseInt(process.env.PRINT_AGENT_WS_PORT);
    if (isNaN(wsPort) || wsPort < 1 || wsPort > 65535) {
      errors.push("PRINT_AGENT_WS_PORT must be a valid port number (1-65535)");
    }
  }

  // Check for port conflicts
  if (process.env.PRINT_AGENT_PORT && process.env.PRINT_AGENT_WS_PORT) {
    if (process.env.PRINT_AGENT_PORT === process.env.PRINT_AGENT_WS_PORT) {
      errors.push(
        "PRINT_AGENT_PORT and PRINT_AGENT_WS_PORT cannot be the same",
      );
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}
