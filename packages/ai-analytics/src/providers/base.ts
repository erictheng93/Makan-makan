/**
 * Base LLM Provider Interface
 * All LLM providers must implement this interface
 */

import type { LLMRequest, LLMResponse, LLMConfig } from "../types";

export abstract class BaseLLMProvider {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Send a request to the LLM and get a response
   */
  abstract chat(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Test if the provider is properly configured and accessible
   */
  abstract test(): Promise<{
    success: boolean;
    latencyMs?: number;
    error?: string;
  }>;

  /**
   * Get the model name being used
   */
  getModel(): string {
    return this.config.model || this.getDefaultModel();
  }

  /**
   * Get the default model for this provider
   */
  protected abstract getDefaultModel(): string;

  /**
   * Validate API key format (optional, provider-specific)
   */
  protected validateApiKey(): boolean {
    return this.config.apiKey.length > 0;
  }
}
